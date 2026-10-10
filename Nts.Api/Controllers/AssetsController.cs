namespace Nts.Api.Controllers;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Nts.Api.Models.Entities;
using Nts.Api.Services;

[ApiController]
[Authorize]
[Route("api/asset")]
public class AssetsController : ControllerBase

{
    private readonly AppDbContext _db;
    private readonly R2Service _r2;

    public AssetsController(AppDbContext db, R2Service r2)
    {
        _db = db;
        _r2 = r2;
    }
    private int GetUserId()
    {
        var claim = User.FindFirst("userId")?.Value;
        return int.TryParse(claim, out var id) ? id : 0;
    }


    // post /api/assets/upload?noteId=1
    [HttpPost("upload")]
    public async Task<IActionResult> Upload(IFormFile file, [FromQuery] int noteId)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { error = "no file provided" });

        var note = await _db.Notes.FirstOrDefaultAsync(n => n.Id == noteId && n.UserId == GetUserId());
        if (note == null)
            return NotFound(new { error = "Note not found" });

        using var ms = new MemoryStream();
        await file.CopyToAsync(ms);
        var fileBytes = ms.ToArray();

        var url = await _r2.UploadAsync(fileBytes, file.FileName, noteId);
        return Ok(new { url });
    }

    // post /api/assets/clean
    [HttpPost("clean")]
    public async Task<IActionResult> Clean([FromBody] CleanRequest request)
    {

        if (request.NoteId <= 0)
            return BadRequest(new { error = "noteId is required" });

        var note = await _db.Notes.FirstOrDefaultAsync(n => n.Id == request.NoteId && n.UserId == GetUserId());
        if (note == null)
            return NotFound(new { error = "note not found" });

        // currentImgaes = img que la note tiene guardada en la bbdd
        // referencedImages = img que el editor aun referencia(frontend envia)
        await _r2.CleanUnusedAsync(
        request.CurrentImages ?? new List<string>(),
        request.ReferencedImages ?? new List<string>()
        );
        return Ok(new { message = "Clean completed" });
    }

}

public class CleanRequest
{
    public int NoteId { get; set; }
    public List<string>? CurrentImages { get; set; }
    public List<string>? ReferencedImages { get; set; }
}
