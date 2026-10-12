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

    //  POST /api/auth/register
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


    //  POST /api/auth/login
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

    // get /api/auth/github
    [HttpGet("github")]
    public IActionResult GitHubLogin()
    {
        var cfg = HttpContext.RequestServices.GetRequiredService<IConfiguration>();
        var ghClientId = cfg["GitHub:ClientId"] ?? Environment.GetEnvironmentVariable("GITHUB_CLIENT_ID") ?? "";
        var ghCallbackUrl = cfg["GitHub:CallbackUrl"] ?? Environment.GetEnvironmentVariable("GITHUB_CALLBACK_URL") ?? "";
        var url = $"https://github.com/login/oauth/authorize?client_id={ghClientId}&redirect_uri={Uri.EscapeDataString(ghCallbackUrl)}&scope=user:email";
        return Redirect(url);
    }

    // get /api/auth/github/callback
    [HttpGet("github/callback")]
    public async Task<IActionResult> GitHubCallback([FromQuery] string code)
    {
        if (string.IsNullOrEmpty(code))
            return BadRequest(new { error = "Missing code parameter" });

        var cfg = HttpContext.RequestServices.GetRequiredService<IConfiguration>();
        var ghClientId = cfg["GitHub:ClientId"] ?? Environment.GetEnvironmentVariable("GITHUB_CLIENT_ID") ?? "";
        var ghClientSecret = cfg["GitHub:ClientSecret"]
                ?? Environment.GetEnvironmentVariable("GITHUB_CLIENT_SECRET") ?? "";
        //intercambiar codigo por un acces_token de github
        using var httpClient = new HttpClient();
        httpClient.DefaultRequestHeaders.Accept.Add(
            new System.Net.Http.Headers.MediaTypeWithQualityHeaderValue("application/json"));
        var tokenResponse = await httpClient.PostAsJsonAsync("https://github.com/login/oauth/access_token", new { client_id = ghClientId, client_secret = ghClientSecret, code });
        var tokenData = await tokenResponse.Content.ReadFromJsonAsync<GitHubTokenResponse>();
        if (tokenData == null || string.IsNullOrEmpty(tokenData.AccessToken)) return BadRequest(new { error = "Failed to get github access token" });
        //obtener el perfil del usuario de github
        httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", tokenData.AccessToken);
        httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("NtsApi");
        var profileResponse = await httpClient.GetFromJsonAsync<GitHubProfile>("https://api.github.com/user");
        if (profileResponse == null) return BadRequest(new { error = "Failed to get github profile" });
        //obtener el email
        var email = profileResponse.Email;
        if (string.IsNullOrEmpty(email))
        {
            var emails = await httpClient.GetFromJsonAsync<List<GitHubEmail>>("https://api.github.com/user/emails");
            email = emails?.FirstOrDefault(e => e.Primary)?.Email ?? $"{profileResponse.Id}@github.noreply.com";
        }
        //buscar o crear un usuario en al bbdd
        var providerId = profileResponse.Id.ToString();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Provider == "github" && u.ProviderId == providerId);
        if (user == null)
        {
            var existingByEmail = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);
            if (existingByEmail != null)
            {
                existingByEmail.Provider = "github";
                existingByEmail.ProviderId = providerId;
                user = existingByEmail;
            }
            else
            {
                user = new User
                {
                    Email = email,
                    Name = profileResponse.Name ?? profileResponse.Login,
                    Provider = "github",
                    ProviderId = providerId,
                    TrialEndsAt = DateTime.UtcNow.AddDays(7)
                };
                _db.Users.Add(user);
            }
            await _db.SaveChangesAsync();
        }
        //generar jwt y redirigir a la app
        var token = _tokenService.GenerateToken(user.Id, user.Email);
        return Redirect($"nts://auth?token={token}");

    }

    //dtos
    public record RegisterRequest(string Email, string Password, string? Name);
    public record LoginRequest(string Email, string Password);
    // dtos github
    public class GitHubTokenResponse
    {
        [System.Text.Json.Serialization.JsonPropertyName("access_token")]
        public string? AccessToken { get; set; }
        [System.Text.Json.Serialization.JsonPropertyName("token_type")]
        public string? TokenType { get; set; }
    }
    public class GitHubProfile
    {
        [System.Text.Json.Serialization.JsonPropertyName("id")]
        public long Id { get; set; }
        [System.Text.Json.Serialization.JsonPropertyName("login")]
        public string? Login { get; set; }
        [System.Text.Json.Serialization.JsonPropertyName("name")]
        public string? Name { get; set; }
        [System.Text.Json.Serialization.JsonPropertyName("email")]
        public string? Email { get; set; }
    }
    public class GitHubEmail
    {
        [System.Text.Json.Serialization.JsonPropertyName("email")]
        public string? Email { get; set; }
        [System.Text.Json.Serialization.JsonPropertyName("primary")]
        public bool Primary { get; set; }
        [System.Text.Json.Serialization.JsonPropertyName("verified")]
        public bool Verified { get; set; }
    }
}