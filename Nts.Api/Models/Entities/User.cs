namespace Nts.Api.Models.Entities;

public class User
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? Password { get; set; }
    public string? Name { get; set; }
    public string Provider { get; set; } = "local";
    public string? ProviderId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public string? StripeCustomerId { get; set; }
    public DateTime? TrialEndsAt { get; set; }

    // Navigation properties
    public ICollection<Note> Notes { get; set; } = new List<Note>();
    public ICollection<Folder> Folders { get; set; } = new List<Folder>();
    public Subscription? Subscription { get; set; }
}
