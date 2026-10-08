namespace Nts.Api.Controllers;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Nts.Api.Models.Entities;

[ApiController]
[Authorize]
[Route("api/folders")]
public class FoldersController : ControllerBase
{
    private readonly AppDbContext _db;
    public FoldersController(AppDbContext db)
    {
        _db = db;
    }


    private int GetUserId()
    {
        var claim = User.FindFirst("userId")?.Value;
        return int.TryParse(claim, out var id) ? id : 0;
    }

    //get /api/folders
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var userId = GetUserId();
        var folders = await _db.Folders.AsNoTracking().Where(f => f.UserId == userId)
        .OrderBy(f => f.Id)
        .ToListAsync();

        return Ok(folders);
    }
    //post /api/folders
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateFolderRequest request)
    {
        var userId = GetUserId();
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { error = "Folder name is requiered" });
        var folder = new Folder()
        {
            Name = request.Name,
            ParentId = request.ParentId,
            UserId = userId,
            IsSystem = false,
            Expanded = true,
            CreatedAt = DateTime.UtcNow
        };
        _db.Folders.Add(folder);
        await _db.SaveChangesAsync();
        return StatusCode(201, folder);
    }

    //put /api/folders/{id}
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateFolderRequest request)
    {
        var userId = GetUserId();
        var folder = await _db.Folders.FirstOrDefaultAsync(f => f.Id == id && f.UserId == userId);
        if (folder == null)
            return NotFound(new { error = "Folder not found" });
        if (request.Name != null) folder.Name = request.Name;
        if (request.ParentId.HasValue) folder.ParentId = request.ParentId.Value;
        if (request.Expanded.HasValue) folder.Expanded = request.Expanded.Value;
        await _db.SaveChangesAsync();
        return Ok(folder);
    }

    //delete /api/folders/{id}
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var userId = GetUserId();
        var folder = await _db.Folders.FirstOrDefaultAsync(f => f.Id == id && f.UserId == userId);
        if (folder == null)
            return NotFound(new { error = "Folder not found" });

        // recursively retrieve all descendant folder ids
        var allUserFolders = await _db.Folders.AsNoTracking().Where(f => f.UserId == userId)
        .ToListAsync();

        var descendantIds = new List<int>();
        GetDescendantIds(id, allUserFolders, descendantIds);

        var targetFolderIds = new List<int> { id };
        targetFolderIds.AddRange(descendantIds);


        // move the associated notes to the trash( soft delete and unlink from the folder)
        var affectedNotes = await _db.Notes.Where(n => n.UserId == userId && n.FolderId.HasValue
        && targetFolderIds.Contains(n.FolderId.Value)).ToListAsync();

        foreach (var note in affectedNotes)
        {
            note.Deleted = true;
            note.FolderId = null;
            note.UpdatedAt = DateTime.UtcNow;
        }

        // delete descendant subfolders and the parent folder
        var foldersToDelete = await _db.Folders.Where(f => f.UserId == userId && targetFolderIds.Contains(f.Id))
            .ToListAsync();
        _db.Folders.RemoveRange(foldersToDelete);

        await _db.SaveChangesAsync();
        return Ok(new { success = true });


    }

    // algorithm to get all subfolders grandchildren,etc..
    private static void GetDescendantIds(int parentId, List<Folder> allFolders, List<int> result)
    {
        var children = allFolders.Where(f => f.ParentId == parentId).Select(f => f.Id).ToList();
        foreach (var childId in children)
        {
            result.Add(childId);
            GetDescendantIds(childId, allFolders, result); ;

        }
    }

}

//DTOs
public class CreateFolderRequest
{
    public string Name { get; set; } = string.Empty;
    public int? ParentId { get; set; }
}
public class UpdateFolderRequest
{
    public string? Name { get; set; }
    public int? ParentId { get; set; }
    public bool? Expanded { get; set; }
}