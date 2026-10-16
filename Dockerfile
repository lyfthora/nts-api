#build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ["Nts.Api/Nts.Api.csproj", "Nts.Api/"]
RUN dotnet restore "Nts.Api/Nts.Api.csproj"

COPY . .
WORKDIR "/src/Nts.Api"
RUN dotnet publish "Nts.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false
#runtime
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
#render
ENV ASPNETCORE_HTTP_PORTS=10000
EXPOSE 10000
ENTRYPOINT ["dotnet", "Nts.Api.dll"]