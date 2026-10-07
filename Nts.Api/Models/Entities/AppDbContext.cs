using Microsoft.EntityFrameworkCore;
using Nts.Api.Models.Entities;

namespace Nts.Api.Models.Entities;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Folder> Folders => Set<Folder>();
    public DbSet<Note> Notes => Set<Note>();
    public DbSet<Subscription> Subscriptions => Set<Subscription>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // User
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(u => u.Email).IsUnique();
            entity.HasIndex(u => u.StripeCustomerId).IsUnique();
        });

        // Folder
        modelBuilder.Entity<Folder>(entity =>
        {
            entity.HasOne(f => f.User)
                  .WithMany(u => u.Folders)
                  .HasForeignKey(f => f.UserId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(f => f.ParentFolder)
                  .WithMany(f => f.SubFolders)
                  .HasForeignKey(f => f.ParentId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // Note
        modelBuilder.Entity<Note>(entity =>
        {
            entity.HasOne(n => n.User)
                  .WithMany(u => u.Notes)
                  .HasForeignKey(n => n.UserId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(n => n.Folder)
                  .WithMany(f => f.Notes)
                  .HasForeignKey(n => n.FolderId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        // Subscription
        modelBuilder.Entity<Subscription>(entity =>
        {
            entity.HasIndex(s => s.StripeSubscriptionId).IsUnique();
            entity.HasIndex(s => s.UserId).IsUnique();

            entity.HasOne(s => s.User)
                  .WithOne(u => u.Subscription)
                  .HasForeignKey<Subscription>(s => s.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
