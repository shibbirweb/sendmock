// The project files a recipe needs around it in languages whose tests run inside a project.

export const goModule = "module app\n\ngo 1.22\n";

// Its own workspace, so Cargo does not take it for a member of SendMock's.
export const rustCargoManifest = `[package]
name = "recipe-example"
version = "0.0.0"
edition = "2021"
publish = false

[workspace]

[dev-dependencies]
reqwest = { version = "0.12", features = ["json"] }
serde_json = "1"
tokio = { version = "1", features = ["macros", "rt-multi-thread"] }
`;

export const csharpTestProject = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <IsPackable>false</IsPackable>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.11.1" />
    <PackageReference Include="xunit" Version="2.9.2" />
    <PackageReference Include="xunit.runner.visualstudio" Version="2.8.2" />
  </ItemGroup>
  <ItemGroup>
    <Using Include="Xunit" />
  </ItemGroup>
</Project>
`;
