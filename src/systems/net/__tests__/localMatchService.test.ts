import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocalMatchService } from "../localMatchService";
import type { MatchmakingStatus } from "../matchTypes";

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string): void { this.data.delete(key); }
  setItem(key: string, value: string): void { this.data.set(key, value); }
}

const make = (storage: Storage | null = new MemoryStorage()) =>
  new LocalMatchService(storage, 10, () => 1000);

describe("LocalMatchService", () => {
  beforeEach(() => vi.useRealTimers());

  it("starts with no friends", async () => {
    expect(await make().getFriends()).toEqual([]);
  });

  it("adds and persists friends across instances sharing storage", async () => {
    const storage = new MemoryStorage();
    await make(storage).addFriend("길가라드");
    expect((await make(storage).getFriends()).map((f) => f.name)).toEqual(["길가라드"]);
  });

  it("rejects blank names and duplicates", async () => {
    const service = make();
    await expect(service.addFriend("   ")).rejects.toThrow();
    await service.addFriend("중복");
    await expect(service.addFriend("중복")).rejects.toThrow();
  });

  it("trims whitespace around names", async () => {
    const service = make();
    const friend = await service.addFriend("  여백  ");
    expect(friend.name).toBe("여백");
  });

  it("removes friends", async () => {
    const service = make();
    const friend = await service.addFriend("삭제대상");
    await service.removeFriend(friend.id);
    expect(await service.getFriends()).toEqual([]);
  });

  it("reports an auto match and announces the status transitions", async () => {
    const service = make();
    const seen: MatchmakingStatus["state"][] = [];
    service.onStatusChange((status) => seen.push(status.state));
    const match = await service.findAutoMatch();
    expect(match.mode).toBe("pvp");
    expect(match.matchKind).toBe("auto");
    expect(match.seed).toBeTruthy();
    expect(seen).toEqual(["searching", "matched"]);
  });

  it("invites a known friend and names them as the opponent", async () => {
    const service = make();
    const friend = await service.addFriend("상대");
    const match = await service.inviteFriend(friend.id);
    expect(match.opponentName).toBe("상대");
    expect(match.matchKind).toBe("friend");
  });

  it("refuses to invite an unknown friend", async () => {
    await expect(make().inviteFriend("nope")).rejects.toThrow();
  });

  it("cancels an in-flight search", async () => {
    const service = make();
    const pending = service.findAutoMatch();
    service.cancel();
    await expect(pending).rejects.toThrow();
  });

  it("keeps working when storage is unavailable", async () => {
    const service = make(null);
    expect(await service.getFriends()).toEqual([]);
    // No storage means nothing persists, but the call must not throw.
    await service.addFriend("임시");
    expect(await service.getFriends()).toEqual([]);
  });

  it("survives corrupt stored data", async () => {
    const storage = new MemoryStorage();
    storage.setItem("warcrest.friends.v1", "{ not json");
    expect(await make(storage).getFriends()).toEqual([]);
  });

  it("drops malformed entries rather than surfacing them", async () => {
    const storage = new MemoryStorage();
    storage.setItem("warcrest.friends.v1", JSON.stringify([
      { id: "ok", name: "정상", online: false },
      { id: 5, name: "잘못된항목" },
    ]));
    expect((await make(storage).getFriends()).map((f) => f.id)).toEqual(["ok"]);
  });
});
