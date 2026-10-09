namespace Nts.Api.Services;

using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

public class TokenService
{
    private readonly string _secret;
    private readonly TimeSpan _expiration = TimeSpan.FromDays(7);

    public TokenService(IConfiguration configuration)
    {
        _secret = configuration["JWT_SECRET"]
            ?? Environment.GetEnvironmentVariable("JWT_SECRET")
            ?? "super_secret_jwt_key_nts_2026_at_least_32_chars!";
    }

    /// <summary>
    /// Genera un JWT con claims { userId, email } — idéntico al payload del backend Node.js.
    /// </summary>
    public string GenerateToken(int userId, string email)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_secret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim("userId", userId.ToString()),
            new Claim("email", email),
        };

        var token = new JwtSecurityToken(
            claims: claims,
            expires: DateTime.UtcNow.Add(_expiration),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    /// <summary>
    /// Verifica un JWT y devuelve el userId y email del payload.
    /// </summary>
    public (int UserId, string Email) VerifyToken(string token)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_secret));
        var handler = new JwtSecurityTokenHandler();

        // Desactivar el mapeo XML para que los claims se lean tal cual (userId, email)
        handler.InboundClaimTypeMap.Clear();

        var parameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            IssuerSigningKey = key,
        };

        var principal = handler.ValidateToken(token, parameters, out _);

        var userIdClaim = principal.FindFirst("userId")?.Value
            ?? throw new SecurityTokenException("Missing userId claim");
        var emailClaim = principal.FindFirst("email")?.Value
            ?? throw new SecurityTokenException("Missing email claim");

        return (int.Parse(userIdClaim), emailClaim);
    }
}
