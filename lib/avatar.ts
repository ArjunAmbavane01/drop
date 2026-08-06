import { Avatar, Style } from "@dicebear/core";
import lorelei from "@dicebear/styles/lorelei.json";

export function getAvatarDataUri(userId: string) {
  const style = new Style(lorelei);
  const avatar = new Avatar(style, {
    seed: userId,
  });
  return avatar.toDataUri();
}
