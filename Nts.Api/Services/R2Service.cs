namespace Nts.Api.Services;
using System.Security.Cryptography;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;


public class R2Service
{
    private readonly IAmazonS3 _s3Client;
    private readonly string _bucketName;
    private readonly string _publicUrl;

    public R2Service(IConfiguration configuration)
    {
        var endpoint = configuration["R2:Endpoint"]
        ?? Environment.GetEnvironmentVariable("R2_ENDPOINT")
        ?? throw new InvalidOperationException("Missing R2:Endpoint configuration");

        var accessKeyId = configuration["R2:AccessKeyId"]
            ?? Environment.GetEnvironmentVariable("R2_ACCESS_KEY_ID")
            ?? throw new InvalidOperationException("Missing R2:AccessKeyId configuration");

         var secretAccessKey = configuration["R2:SecretAccessKey"]
            ?? Environment.GetEnvironmentVariable("R2_SECRET_ACCESS_KEY")
            ?? throw new InvalidOperationException("Missing R2:SecretAccessKey configuration");
        _bucketName = configuration["R2:BucketName"]
            ?? Environment.GetEnvironmentVariable("R2_BUCKET_NAME")
            ?? "nts-assets";
        _publicUrl = configuration["R2:PublicUrl"]
            ?? Environment.GetEnvironmentVariable("R2_PUBLIC_URL")
            ?? "";

            var credentials = new BasicAWSCredentials(accessKeyId, secretAccessKey);
            var config = new AmazonS3Config
            {
                ServiceURL = endpoint,
                ForcePathStyle = true
            };
            _s3Client = new AmazonS3Client(credentials, config);    
    }

    public async Task<string> UploadAsync(byte[] fileByte, string fileName, int noteId)
    {
        //Calcular hash MD5 de los bytes del archivo
        using var md5 = MD5.Create();
        var hashBytes = md5.ComputeHash(fileByte);
        var hash = Convert.ToHexString(hashBytes).ToLower();

        // generar nombre de la clave en r2: img-{noteId}-{hash:8}.ext
        var ext = Path.GetExtension(fileName);
        var key = $"img-{noteId}-{hash[..8]}{ext}";

        // subir a cloudflare r2
        using var stream = new MemoryStream(fileByte);
        var putRequest = new PutObjectRequest
        {
            BucketName = _bucketName,
            Key = key,
            InputStream = stream,
            ContentType = GetContentType(ext),
            DisablePayloadSigning = true
        };

        await _s3Client.PutObjectAsync(putRequest);

        // deovlver la url public
        return $"{_publicUrl.TrimEnd('/')}/{key}";
    }

    // elimina una img de cloudflare por su clave

    public async Task DeleteAsync(string key)
    {
        var deleteRequest = new DeleteObjectRequest
        {
            BucketName = _bucketName,
            Key = key
        };
        await _s3Client.DeleteObjectAsync(deleteRequest);
    }

    // limpia las img de cloudflare queya no esten referenciadas en la nots

    public async Task CleanUnusedAsync(List<string> currentImages, List<string> referencedImages)
    {
        var unused = currentImages.Where(img => !referencedImages.Contains(img)).ToList();
        foreach (var imgUrl in unused)
        {
            var key =imgUrl.Split('/').LastOrDefault();
            if (!string.IsNullOrEmpty(key))
            {
                await DeleteAsync(key);
            }
        }
    }

    private static string GetContentType(string ext)
    {
        return ext.ToLower() switch
        {
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".gif" => "image/gif",
            ".webp" => "image/webp",
            ".svg" => "image/svg+xml",
            _ => "application/octet-stream"
        };
    }

}