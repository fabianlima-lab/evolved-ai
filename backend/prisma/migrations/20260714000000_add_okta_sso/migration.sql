-- Okta OIDC SSO: subscribers can sign in via a partner org's Okta tile
ALTER TABLE "subscribers" ADD COLUMN "okta_id" VARCHAR(255);

CREATE UNIQUE INDEX "subscribers_okta_id_key" ON "subscribers"("okta_id");
