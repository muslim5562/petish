-- At most one active custodianship per pet.
CREATE UNIQUE INDEX "PetOwnership_one_current" ON "PetOwnership" ("petId") WHERE "endedAt" IS NULL;
-- Main photo must belong to the pet that references it. Checked at commit.
CREATE FUNCTION petish_check_main_photo() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."mainImageId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "PetImage" WHERE id=NEW."mainImageId" AND "petId"=NEW.id) THEN
  RAISE EXCEPTION 'Main photo must belong to this pet';
 END IF;
 RETURN NEW;
END; $$;
CREATE CONSTRAINT TRIGGER "Pet_main_photo_owner" AFTER INSERT OR UPDATE ON "Pet" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION petish_check_main_photo();
-- Current custody must agree with the active history row at transaction commit.
CREATE FUNCTION petish_check_custody() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid;
BEGIN
 IF TG_TABLE_NAME='Pet' THEN target=NEW.id; ELSE target=COALESCE(NEW."petId",OLD."petId"); END IF;
 IF EXISTS (SELECT 1 FROM "Pet" WHERE id=target) AND NOT EXISTS (SELECT 1 FROM "Pet" p JOIN "PetOwnership" o ON o."petId"=p.id AND o."ownerId"=p."ownerId" AND o."endedAt" IS NULL WHERE p.id=target) THEN
  RAISE EXCEPTION 'Pet custody must match active ownership history';
 END IF;
 RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER "Pet_custody_consistency" AFTER INSERT OR UPDATE ON "Pet" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION petish_check_custody();
CREATE CONSTRAINT TRIGGER "History_custody_consistency" AFTER INSERT OR UPDATE OR DELETE ON "PetOwnership" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION petish_check_custody();
