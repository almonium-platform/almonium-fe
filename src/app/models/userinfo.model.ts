import {Language} from "./language.enum";

export interface UserInfo {
  id: string;
  username: string | null;
  email: string;
  uiLang: string | null;
  profilePicLink: string | null;
  background: string | null;
  streak: number | null;
  targetLangs: Language[];
  fluentLangs: Language[];
  setupCompleted: boolean;
  tags: string[] | null;
}
