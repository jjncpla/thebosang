/* lib/tfstore.ts  ← 프로젝트 루트의 lib/ 폴더에 위치 (app/ 바깥) */

export type Message = {
  id:         number;
  text?:      string;
  date:       number;
  file_url?:  string;
  file_name?: string;
};

export const tfMessages: Message[] = [

];