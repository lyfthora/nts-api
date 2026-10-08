using static System.DateTime;
namespace Nts.Api.Controllers;

using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Nts.Api.Models.Entities;

[ApiController]
[Authorize]
[Route("api/notes")]
public class NotesController : ControllerBase
{
    private readonly AppDbContext _db;
    public NotesController(AppDbContext db)
    {
        _db = db;
    }

    private int GetUserId()
    {
        var claim = User.FindFirst("userId")?.Value;
        return int.TryParse(claim, out var id) ? id : 0;
    }


    // get /api/notes
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var userId = GetUserId();

        var notes = await _db.Notes.AsNoTracking().Where(n => n.UserId == userId && !n.Deleted).OrderByDescending(n => n.UpdatedAt).Select(n => new
        {
            n.Id,
            n.Name,
            n.Preview,
            n.Color,
            n.Pinned,
            n.Deleted,
            n.Status,
            n.Tags,
            n.NoteType,
            n.Images,
            n.FolderId,
            n.CreatedAt,
            n.UpdatedAt
        }).ToListAsync();
        return Ok(notes);
    }

    //get /api/notes/all
    [HttpGet("all")]
    public async Task<IActionResult> GetAllData()
    {
        var userId = GetUserId();
        var notes = await _db.Notes.AsNoTracking().Where(n => n.UserId == userId).OrderByDescending(n => n.UpdatedAt)
        .Select(n => new
        {
            n.Id,
            n.Name,
            n.Preview,
            n.Color,
            n.Pinned,
            n.Deleted,
            n.Status,
            n.Tags,
            n.NoteType,
            n.Images,
            n.FolderId,
            n.CreatedAt,
            n.UpdatedAt
        }).ToListAsync();

        var folders = await _db.Folders.AsNoTracking().Where(f => f.UserId == userId).OrderBy(f => f.Id)
        .ToListAsync();
        return Ok(new { notes, folders });
    }


    // get /api/notes/{id}/content
    [HttpGet("{id:int}/content")]
    public async Task<IActionResult> GetContent(int id)
    {
        var userId = GetUserId();
        var note = await _db.Notes.AsNoTracking().Where(n => n.Id == id && n.UserId == userId).Select(n => new { n.Content, n.DrawingData })
        .FirstOrDefaultAsync();

        if (note == null)
        {
            return Ok(new { content = "", drawingData = (string?)null });
        }
        return Ok(note);
    }

    // post /api/notes
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateNoteRequest request)
    {
        var userId = GetUserId();
        var content = request.Content ?? "";
        var preview = !string.IsNullOrWhiteSpace(request.Preview)
            ? request.Preview
            : GeneratePreview(content);
        var note = new Note
        {
            Name = request.Name ?? "",
            Content = content,
            Preview = preview,
            Color = request.Color ?? "#ffffff",
            Pinned = request.Pinned ?? false,
            Deleted = request.Deleted ?? false,
            Status = request.Status ?? "",
            Tags = request.Tags ?? new List<string>(),
            NoteType = request.NoteType ?? "text",
            DrawingData = request.DrawingData,
            Images = request.Images ?? new List<string>(),
            FolderId = request.FolderId,
            UserId = userId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        _db.Notes.Add(note);
        await _db.SaveChangesAsync();
        return StatusCode(201, note);
    }

    //put /api/notes/{id}
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateNoteRequest request)
    {
        var userId = GetUserId();
        var note = await _db.Notes.FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);
        if (note == null)
            return NotFound(new { error = "Note not found" });
        if (request.Name != null) note.Name = request.Name;
        if (request.Color != null) note.Color = request.Color;
        if (request.Pinned.HasValue) note.Pinned = request.Pinned.Value;
        if (request.Deleted.HasValue) note.Deleted = request.Deleted.Value;
        if (request.Status != null) note.Status = request.Status;
        if (request.Tags != null) note.Tags = request.Tags;
        if (request.NoteType != null) note.NoteType = request.NoteType;
        if (request.DrawingData != null) note.DrawingData = request.DrawingData;
        if (request.Images != null) note.Images = request.Images;
        if (request.FolderId.HasValue) note.FolderId = request.FolderId.Value;

        if (request.Content != null)
        {
            note.Content = request.Content;
            note.Preview = GeneratePreview(request.Content);
        }
        else if (request.Preview != null)
        {
            note.Preview = request.Preview;
        }

        note.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(note);
    }

    // delete /api/notes/{id}
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var userId = GetUserId();
        var note = await _db.Notes.FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);
        if (note == null)
            return NotFound(new { error = "note not found" });

        note.Deleted = true;
        note.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(new { success = true });
    }


    //post /api/notes/{id}/restore
    [HttpPost("{id:int}/restore")]
    public async Task<IActionResult> Restore(int id)
    {

        var userId = GetUserId();
        var note = await _db.Notes.FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);
        if (note == null)
            return NotFound(new { error = "Note not found" });

        note.Deleted = false;
        note.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(new { success = true });
    }


    //delete /api/notes/{id}/permanent
    [HttpDelete("{id:int}/permanent")]
    public async Task<IActionResult> PermanentDelete(int id)
    {

        var userId = GetUserId();
        var note = await _db.Notes.FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);
        if (note == null)
            return NotFound(new { error = "Note not found" });
        _db.Notes.Remove(note);
        await _db.SaveChangesAsync();
        return Ok(new { success = true });

    }


    //get /api/notes/{noteName}/backlinks

    [HttpGet("{noteName}/backlinks")]
    public async Task<IActionResult> GetBacklinks(string noteName)
    {
        var userId = GetUserId();
        var decodedName = Uri.UnescapeDataString(noteName);
        var pattern = $"[[{decodedName}]]";
        var matchingNotes = await _db.Notes.AsNoTracking()
            .Where(n => n.UserId == userId && !n.Deleted && n.Content.Contains(pattern))
            .Select(n => new
            {
                n.Id,
                n.Name,
                n.Content
            })
            .ToListAsync();
        var backlinks = matchingNotes.Select(n => new
        {

            n.Id,
            n.Name,
            preview = n.Content.Length > 100 ? n.Content.Substring(0, 100) : n.Content
        });
        return Ok(backlinks);
    }

    private static string GeneratePreview(string content)
    {
        if (string.IsNullOrEmpty(content)) return "";
        var withoutImages = Regex.Replace(content, @"!\[.*?\]\(.*?\)", "");
        var cleaned = Regex.Replace(withoutImages, @"[#*_`~\[\]]", "").Trim();
        return cleaned.Length > 150 ? cleaned.Substring(0, 150) : cleaned;
    }


    //DTOs

    public class CreateNoteRequest
    {
        public string? Name { get; set; }
        public string? Content { get; set; }
        public string? Preview { get; set; }
        public string? Color { get; set; }
        public bool? Pinned { get; set; }
        public bool? Deleted { get; set; }
        public string? Status { get; set; }
        public List<string>? Tags { get; set; }
        public string? NoteType { get; set; }
        public string? DrawingData { get; set; }
        public List<string>? Images { get; set; }
        public int? FolderId { get; set; }
    }
    public class UpdateNoteRequest
    {
        public string? Name { get; set; }
        public string? Content { get; set; }
        public string? Preview { get; set; }
        public string? Color { get; set; }
        public bool? Pinned { get; set; }
        public bool? Deleted { get; set; }
        public string? Status { get; set; }
        public List<string>? Tags { get; set; }
        public string? NoteType { get; set; }
        public string? DrawingData { get; set; }
        public List<string>? Images { get; set; }
        public int? FolderId { get; set; }

    }
}








