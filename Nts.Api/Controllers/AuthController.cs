namespace Nts.Api.Controllers;

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Nts.Api.Models.Entities;
using Nts.Api.Services;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly TokenService _tokenService;

    public AuthController(AppDbContext db, TokenService tokenService)
    {
        _db = db;
        _tokenService = tokenService;
    }

    // ──────────────────────────────────────
    //  POST /api/auth/register
    // ──────────────────────────────────────
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { error = "Email and password required" });

        var existing = await _db.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
        if (existing != null)
            return BadRequest(new { error = "Email already registered" });

        var hashedPassword = BCrypt.Net.BCrypt.HashPassword(request.Password, workFactor: 10);

        var user = new User
        {
            Email = request.Email,
            Password = hashedPassword,
            Name = request.Name,
            TrialEndsAt = DateTime.UtcNow.AddDays(7),
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        var token = _tokenService.GenerateToken(user.Id, user.Email);

        return StatusCode(201, new
        {
            token,
            user = new { id = user.Id, email = user.Email, name = user.Name }
        });
    }

    // ──────────────────────────────────────
    //  POST /api/auth/login
    // ──────────────────────────────────────
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { error = "Email and password required" });

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
        if (user == null)
            return Unauthorized(new { error = "Invalid email or password" });

        if (string.IsNullOrEmpty(user.Password))
            return Unauthorized(new { error = $"This account uses {user.Provider} login" });

        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.Password))
            return Unauthorized(new { error = "Invalid email or password" });

        var token = _tokenService.GenerateToken(user.Id, user.Email);

        return Ok(new
        {
            token,
            user = new { id = user.Id, email = user.Email, name = user.Name }
        });
    }
}

// ──────────────────────────────────────
//  DTOs (Request Bodies)
// ──────────────────────────────────────
public record RegisterRequest(string Email, string Password, string? Name);
public record LoginRequest(string Email, string Password);
