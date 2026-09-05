-- DataMigration
UPDATE "OnboardingTask" SET "requiresUpload" = true WHERE "title" = 'Enviar documentos';
