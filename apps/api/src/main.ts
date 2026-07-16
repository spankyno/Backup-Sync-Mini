import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";

function getAllowedOrigins(): string[] | true {
  const raw = process.env.ALLOWED_ORIGINS;
  if (!raw) {
    // Sin configurar: solo desarrollo local. En producción SIEMPRE
    // define ALLOWED_ORIGINS (ver .env.example) con el/los dominios
    // reales de la Web App (p.ej. https://backuphub.example.com y/o
    // https://<proyecto>.workers.dev).
    return ["http://localhost:3000"];
  }
  return raw.split(",").map((origin) => origin.trim());
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: getAllowedOrigins(),
      credentials: true,
    },
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle("BackupHub API")
    .setDescription(
      "API central de BackupHub: gestiona usuarios, agentes, planes de backup, historial y restauración.",
    )
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  const port = process.env.API_PORT ?? 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`BackupHub API escuchando en http://localhost:${port}`);
  // eslint-disable-next-line no-console
  console.log(`Swagger disponible en http://localhost:${port}/api/docs`);
}

bootstrap();

