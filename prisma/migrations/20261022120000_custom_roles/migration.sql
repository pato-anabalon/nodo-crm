-- A company can make its own profiles: those have no standard key.
-- The unique index on ("companyId", "key") stays as it is — Postgres treats
-- nulls as distinct, so it still allows one standard profile per key and any
-- number of custom ones.
ALTER TABLE "Role" ALTER COLUMN "key" DROP NOT NULL;
