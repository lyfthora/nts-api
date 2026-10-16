namespace Nts.Api.Services;

using Amazon.S3;
using Microsoft.EntityFrameworkCore;
using Nts.Api.Models.Entities;
using Stripe;
using Stripe.Checkout;

public class StripeService
{
    private readonly IConfiguration _cfg;
    public StripeService(IConfiguration configuration)
    {
        _cfg = configuration;
        var secretKey = _cfg["Stripe:SecretKey"] ?? Environment.GetEnvironmentVariable("STRIPE_SECRET_KEY") ?? "";
        StripeConfiguration.ApiKey = secretKey;
    }
    private string GetFrontendUrl() => _cfg["Stripe:FrontendUrl"] ?? Environment.GetEnvironmentVariable("FRONTEND_URL") ?? "nts://";
    private string GetPriceId() => _cfg["Stripe:PriceId"] ?? Environment.GetEnvironmentVariable("STRIPE_PRICE_ID") ?? "";
    private string GetWebhookSecret() => _cfg["Stripe:WebhookSecret"] ?? Environment.GetEnvironmentVariable("STRIPE_WEBHOOK_SECRET") ?? "";
    //get subs status
    public async Task<object> GetSubscriptionStatus(AppDbContext db, int userId)
    {
        var user = await db.Users.Include(u => u.Subscription).FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null) throw new Exception("User not found");
        var now = DateTime.UtcNow;
        //subs active?
        if (user.Subscription != null)
        {
            var isExpired = user.Subscription.Status == "canceled" && user.Subscription.CurrentPeriodEnd.HasValue && user.Subscription.CurrentPeriodEnd.Value < now;
            if (!isExpired)
            {
                return new
                {
                    status = user.Subscription.Status,
                    trialEndsAt = user.TrialEndsAt?.ToString("o"),
                    CurrentPeriodEnd = user.Subscription.CurrentPeriodEnd?.ToString("o"),
                    cancelAtPeriodEnd = user.Subscription.CancelAtPeriodEnd

                };
            }
        }

        // test period
        if (user.TrialEndsAt.HasValue && user.TrialEndsAt.Value > now)
        {
            return new
            {
                status = "trialing",
                trialEndsAt = user.TrialEndsAt.Value.ToString("o"),
                currentPeriodEnd = (string?)null,
                cancelAtPeriodEnd = false
            };
        }
        //expired
        return new
        {
            status = "expired",
            trialEndsAt = user.TrialEndsAt?.ToString("o"),
            currentPeriodEnd = (string?)null,
            cancelAtPeriodEnd = false
        };
    }
    //create checkout session
    public async Task<object> CreateCheckoutSession(AppDbContext db, int userId)
    {
        var priceId = GetPriceId();
        if (string.IsNullOrEmpty(priceId)) throw new Exception("Stripe checkout is nto configured");
        var user = await db.Users.FindAsync(userId);
        if (user == null) throw new Exception("user not found");
        var customerId = user.StripeCustomerId;
        //create customer if not exist yet
        if (string.IsNullOrEmpty(customerId))
        {
            var customerService = new CustomerService();
            var customer = await customerService.CreateAsync(new CustomerCreateOptions
            {
                Email = user.Email,
                Metadata = new Dictionary<string, string> { { "userId", user.Id.ToString()
                }}
            });
            customerId = customer.Id;
            user.StripeCustomerId = customerId;
            await db.SaveChangesAsync();
        }
        var frontendUrl = GetFrontendUrl();
        var sessionService = new SessionService();
        var session = await sessionService.CreateAsync(new SessionCreateOptions
        {
            Customer = customerId,
            LineItems = new List<SessionLineItemOptions>
            {
                new() { Price = priceId, Quantity = 1}
            },
            Mode = "subscription",
            SuccessUrl = $"{frontendUrl}payment-success?session_id={{CHECKOUT_SESSION_ID}}",
            CancelUrl = $"{frontendUrl}payment-cancel",
            SubscriptionData = new SessionSubscriptionDataOptions
            {
                Metadata = new Dictionary<string, string> { { "userId", user.Id.ToString()
                } }
            }

        });
        return new { url = session.Url };
    }

    //create portal session
    public async Task<object> CreatePortalSession(AppDbContext db, int userId, string returnUrl)
    {
        var user = await db.Users.Include(u => u.Subscription).FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null) throw new Exception("User not found");
        if (string.IsNullOrEmpty(user.StripeCustomerId) || user.Subscription == null) throw new Exception("No active subscription found to manage");

        var portalService = new Stripe.BillingPortal.SessionService();
        var session = await portalService.CreateAsync(new Stripe.BillingPortal.SessionCreateOptions
        {
            Customer = user.StripeCustomerId,
            ReturnUrl = returnUrl
        });
        return new { url = session.Url };
    }

    //handle webhook event
    public async Task HandleWebhookEvent(AppDbContext db, string payload, string signature)
    {
        var webhookSecret = GetWebhookSecret();
        if (string.IsNullOrEmpty(webhookSecret)) throw new Exception("Stripe webhook is not configured");
        var stripeEvent = EventUtility.ConstructEvent(payload, signature, webhookSecret);
        switch (stripeEvent.Type)
        {
            case EventTypes.CheckoutSessionCompleted:
                {
                    var session = stripeEvent.Data.Object as Stripe.Checkout.Session;
                    if (session != null) await SyncCheckoutSession(db, session);
                    break;
                }
            case EventTypes.CustomerSubscriptionCreated:
            case EventTypes.CustomerSubscriptionUpdated:
                {
                    var sub = stripeEvent.Data.Object as Stripe.Subscription;
                    if (sub != null) await SyncSubscription(db, sub);
                    break;
                }
            case EventTypes.CustomerSubscriptionDeleted:
                {
                    var sub = stripeEvent.Data.Object as Stripe.Subscription;
                    if (sub != null)
                    {
                        var toDelete = await db.Subscriptions.FirstOrDefaultAsync(s => s.StripeSubscriptionId == sub.Id);
                        if (toDelete != null)
                        {
                            db.Subscriptions.Remove(toDelete);
                            await db.SaveChangesAsync();
                        }
                    }
                    break;
                }
        }
    }
    private async Task SyncCheckoutSession(AppDbContext db, Stripe.Checkout.Session session)
    {
        var userIdStr = session.Metadata?.GetValueOrDefault("userId");
        if (string.IsNullOrEmpty(userIdStr) || !int.TryParse(userIdStr, out var userId))
            return;

        var customerId = session.CustomerId;
        if (string.IsNullOrEmpty(customerId)) return;

        var user = await db.Users.FindAsync(userId);
        if (user == null) return;

        user.StripeCustomerId = customerId;
        await db.SaveChangesAsync();

        if (!string.IsNullOrEmpty(session.SubscriptionId))
        {
            var subService = new SubscriptionService();
            var stripeSub = await subService.GetAsync(session.SubscriptionId);
            await SyncSubscription(db, stripeSub);
        }
    }
    private async Task SyncSubscription(AppDbContext db, Stripe.Subscription stripeSub)
    {
        var customerId = stripeSub.CustomerId;
        if (string.IsNullOrEmpty(customerId)) return;

        var user = await db.Users.FirstOrDefaultAsync(u => u.StripeCustomerId == customerId);
        if (user == null) return;
        var periodStart = stripeSub.Items?.Data?.FirstOrDefault()?.CurrentPeriodStart;
        var periodEnd = stripeSub.Items?.Data?.FirstOrDefault()?.CurrentPeriodEnd;
        var existing = await db.Subscriptions.FirstOrDefaultAsync(s => s.UserId == user.Id);
        if (existing != null)
        {
            existing.StripeSubscriptionId = stripeSub.Id;
            existing.Status = stripeSub.Status;
            existing.CurrentPeriodStart = periodStart;
            existing.CurrentPeriodEnd = periodEnd;
            existing.CancelAtPeriodEnd = stripeSub.CancelAtPeriodEnd;
            existing.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            db.Subscriptions.Add(new Nts.Api.Models.Entities.Subscription

            {
                UserId = user.Id,
                StripeSubscriptionId = stripeSub.Id,
                Status = stripeSub.Status,
                CurrentPeriodStart = periodStart,
                CurrentPeriodEnd = periodEnd,
                CancelAtPeriodEnd = stripeSub.CancelAtPeriodEnd
            });
        }
        await db.SaveChangesAsync();
    }
}
