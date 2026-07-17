import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  Campaign,
  CampaignMember,
  CampaignMemberRepository,
  CampaignRepository,
  NotFoundError,
  UserId,
  ValidationError,
} from "@storyforge/domain";
import { CampaignService } from "./CampaignService";

function makeRepository(): CampaignRepository {
  return {
    findById: vi.fn(),
    existsByName: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
    listCampaigns: vi.fn(),
  };
}

function makeCampaignMemberRepository(): CampaignMemberRepository {
  return {
    listByCampaign: vi.fn(),
    findByCampaignAndUser: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transferOwnership: vi.fn(),
  };
}

describe("CampaignService", () => {
  let repository: CampaignRepository;
  let campaignMemberRepository: CampaignMemberRepository;
  let service: CampaignService;

  beforeEach(() => {
    repository = makeRepository();
    campaignMemberRepository = makeCampaignMemberRepository();
    service = new CampaignService(repository, campaignMemberRepository);
  });

  describe("createCampaign", () => {
    it("creates the campaign when the name is free", async () => {
      vi.mocked(repository.existsByName).mockResolvedValue(false);
      vi.mocked(repository.create).mockImplementation(async (c) => c);
      const ownerId = UserId.create().toString();

      const campaign = await service.createCampaign({
        input: { name: "New Campaign", description: "desc" },
        ownerId,
      });

      expect(campaign.Name).toBe("New Campaign");
      expect(repository.create).toHaveBeenCalledTimes(1);
    });

    it("adds the requesting user as the campaign owner", async () => {
      vi.mocked(repository.existsByName).mockResolvedValue(false);
      vi.mocked(repository.create).mockImplementation(async (c) => c);
      const ownerId = UserId.create().toString();

      const campaign = await service.createCampaign({
        input: { name: "New Campaign", description: "desc" },
        ownerId,
      });

      expect(campaignMemberRepository.create).toHaveBeenCalledTimes(1);
      const [member] = vi.mocked(campaignMemberRepository.create).mock
        .calls[0] as [CampaignMember];
      expect(member.CampaignId).toBe(campaign.Id.toString());
      expect(member.UserId.toString()).toBe(ownerId);
      expect(member.Role).toBe("OWNER");
    });

    it("rejects a duplicate name without touching create", async () => {
      vi.mocked(repository.existsByName).mockResolvedValue(true);

      await expect(
        service.createCampaign({
          input: { name: "Taken", description: "desc" },
          ownerId: UserId.create().toString(),
        }),
      ).rejects.toThrow(ValidationError);
      expect(repository.create).not.toHaveBeenCalled();
      expect(campaignMemberRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("getCampaignById", () => {
    it("returns null when the repository finds nothing", async () => {
      vi.mocked(repository.findById).mockResolvedValue(null);

      await expect(
        service.getCampaignById("00000000-0000-0000-0000-000000000000"),
      ).resolves.toBeNull();
    });
  });

  describe("updateCampaign", () => {
    it("throws NotFoundError when the campaign does not exist", async () => {
      vi.mocked(repository.findById).mockResolvedValue(null);

      await expect(
        service.updateCampaign({ input: { id: "missing" } }),
      ).rejects.toThrow(NotFoundError);
    });

    it("renames and updates the description", async () => {
      const campaign = Campaign.create({ name: "Old Name" });
      vi.mocked(repository.findById).mockResolvedValue(campaign);
      vi.mocked(repository.update).mockImplementation(async (c) => c);

      const updated = await service.updateCampaign({
        input: {
          id: campaign.Id.toString(),
          name: "New Name",
          description: "New desc",
        },
      });

      expect(updated.Name).toBe("New Name");
      expect(updated.Description).toBe("New desc");
    });

    it("rejects renaming to an empty string instead of silently ignoring it", async () => {
      const campaign = Campaign.create({ name: "Old Name" });
      vi.mocked(repository.findById).mockResolvedValue(campaign);

      await expect(
        service.updateCampaign({
          input: { id: campaign.Id.toString(), name: "" },
        }),
      ).rejects.toThrow(ValidationError);
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  describe("archiveCampaign", () => {
    it("throws NotFoundError when the campaign does not exist", async () => {
      vi.mocked(repository.findById).mockResolvedValue(null);

      await expect(service.archiveCampaign("missing")).rejects.toThrow(
        NotFoundError,
      );
    });

    it("throws when the campaign is already archived", async () => {
      const campaign = Campaign.create({ name: "Old Name" });
      campaign.addMember(
        CampaignMember.create({
          campaignId: campaign.Id.toString(),
          userId: UserId.create(),
          role: "OWNER",
        }),
      );
      campaign.archive();
      vi.mocked(repository.findById).mockResolvedValue(campaign);

      await expect(
        service.archiveCampaign(campaign.Id.toString()),
      ).rejects.toThrow(ValidationError);
    });

    it("throws when the campaign has no owner", async () => {
      const campaign = Campaign.create({ name: "Old Name" });
      vi.mocked(repository.findById).mockResolvedValue(campaign);

      await expect(
        service.archiveCampaign(campaign.Id.toString()),
      ).rejects.toThrow("because it has no owner");
      expect(repository.archive).not.toHaveBeenCalled();
    });

    it("archives when the campaign has an owner", async () => {
      const campaign = Campaign.create({ name: "Old Name" });
      campaign.addMember(
        CampaignMember.create({
          campaignId: campaign.Id.toString(),
          userId: UserId.create(),
          role: "OWNER",
        }),
      );
      vi.mocked(repository.findById).mockResolvedValue(campaign);

      await service.archiveCampaign(campaign.Id.toString());

      expect(repository.archive).toHaveBeenCalledWith(campaign);
      expect(campaign.ArchivedAt).toBeInstanceOf(Date);
    });
  });

  describe("listCampaigns", () => {
    it("delegates to the repository, scoped to the given user", async () => {
      const campaigns = [Campaign.create({ name: "A" })];
      vi.mocked(repository.listCampaigns).mockResolvedValue(campaigns);
      const userId = UserId.create().toString();

      await expect(service.listCampaigns(userId)).resolves.toBe(campaigns);
      expect(repository.listCampaigns).toHaveBeenCalledWith(userId);
    });
  });
});
