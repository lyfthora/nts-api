namespace Nts.Api.Models.Entities;

public class Note
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string Preview { get; set; } = string.Empty;
    public string Color { get; set; } = "#ffffff";
    public bool Pinned { get; set; } = false;
    public bool Deleted { get; set; } = false;
    public string Status { get; set; } = string.Empty;
    public List<string> Tags { get; set; } = new();
    public string NoteType { get; set; } = "text";
    public string? DrawingData { get; set; }
    public List<string> Images { get; set; } = new();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Foreign Keys & Navigation
    public int? FolderId { get; set; }
    public Folder? Folder { get; set; }

    public int? UserId { get; set; }
    public User? User { get; set; }
}
