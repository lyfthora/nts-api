namespace Nts.Api.Controllers;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Nts.Api.Models.Entities;
using Nts.Api.Services;

[ApiController]
[Route("api/subscription")]
public class SubscriptionController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly StripeService _stripe;

    public SubscriptionController(AppDbContext db, StripeService stripe)
    {
        _db = db;
        _stripe = stripe;
    }

    private int GetUserId()
    {
        var claim = User.FindFirst("userId")?.Value;
        return int.TryParse(claim, out var id) ? id : 0;
    }

    // get /api/subscription/status
    [Authorize]
    [HttpGet("status")]
    public async Task<IActionResult> GetStatus()
    {
        try
        {
            var result = await _stripe.GetSubscriptionStatus(_db, GetUserId());
            return Ok(result);
        }
        catch (Exception ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    // post /api/subscription/checkout
    [Authorize]
    [HttpPost("checkout")]
    public async Task<IActionResult> Checkout()
    {
        try
        {
            var result = await _stripe.CreateCheckoutSession(_db, GetUserId());
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(503, new { error = ex.Message });
        }
    }

    // post /api/subscription/portal
    [Authorize]
    [HttpPost("portal")]
    public async Task<IActionResult> Portal()
    {
        try
        {
            var protocol = Request.IsHttps || Request.Headers["X-Forwarded-Proto"] == "https"
                ? "https" : "http";
            var returnUrl = $"{protocol}://{Request.Host}/api/subscription/portal-return";
            var result = await _stripe.CreatePortalSession(_db, GetUserId(), returnUrl);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }
    // get /api/subscription/portal-return (publico, sin auth)
    [HttpGet("portal-return")]
    public IActionResult PortalReturn()
    {
        var html = @"
<!DOCTYPE html>
<html>
<head>
  <title>Redirecting to NTS...</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      display: flex; align-items: center; justify-content: center;
      height: 100vh; margin: 0; background: #121212; color: #fff;
    }
    .container { text-align: center; }
    h1 { font-size: 20px; font-weight: 500; margin-bottom: 10px; }
    p { color: #888; font-size: 14px; }
  </style>
</head>
<body>
  <div class='container'>
    <h1>Opening NTS in desktop...</h1>
    <p>If your browser didn't open the app automatically, you can safely close this window.</p>
  </div>
  <script>
    window.location.href = 'nts://payment-success';
    setTimeout(function() { window.close(); }, 3000);
  </script>
</body>
</html>";
        return Content(html, "text/html");
    }

    // post /api/webhook/stripe (publico, recibe raw body)
    [HttpPost("/api/webhook/stripe")]
    public async Task<IActionResult> StripeWebhook()
    {
        var signature = Request.Headers["Stripe-Signature"].ToString();
        using var reader = new StreamReader(Request.Body);
        var payload = await reader.ReadToEndAsync();
        try
        {
            await _stripe.HandleWebhookEvent(_db, payload, signature);
            return Ok(new { received = true });
        }
        catch (Exception ex)
        {
            return BadRequest($"Webhook Error: {ex.Message}");
        }
    }
}





