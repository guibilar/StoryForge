-- A campaign must have exactly one OWNER. This was previously enforced only
-- by an application-level read-then-write check (assertNoOtherOwner), which
-- is a TOCTOU race: two concurrent promote-to-owner calls can both pass the
-- check before either commits, leaving a campaign with two OWNERs. Add a
-- real DB-level constraint to close the race.
CREATE UNIQUE INDEX "CampaignMember_campaignId_owner_key" ON "CampaignMember"("campaignId") WHERE "role" = 'OWNER'::"CampaignRole";
