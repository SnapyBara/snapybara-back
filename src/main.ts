import { NestFactory } from "@nestjs/core";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: ["http://localhost:3000", "http://localhost:3001"],
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle("SnapyBara API")
    .setDescription(
      "API documentation for SnapyBara - Photo discovery and geolocation app",
    )
    .setVersion("1.0")
    .addTag("auth", "Authentication endpoints")
    .addTag("users", "User management")
    .addTag("places", "Places and points of interest")
    .addTag("photos", "Photo management")
    .addTag("reviews", "Reviews and ratings")
    .addTag("favorites", "User favorites")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        name: "JWT",
        description: "Enter JWT token",
        in: "header",
      },
      "JWT-auth",
    )
    .addServer("http://localhost:3000", "Development server")
    .addServer("https://api.snapybara.com", "Production server")
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup("api-docs", app, document, {
    customSiteTitle: "SnapyBara API Documentation",
    customfavIcon: "/favicon.ico",
    customCss: `
      .topbar-wrapper img { content: url('/logo.png'); }
      .swagger-ui .topbar { background-color: #2c3e50; }
    `,
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
    },
  });

  SwaggerModule.setup("api-docs-json", app, document);

  await app.listen(3000);
  console.log(`🚀 Application is running on: ${await app.getUrl()}`);
  console.log(`📚 Swagger documentation: ${await app.getUrl()}/api-docs`);
}
bootstrap();
