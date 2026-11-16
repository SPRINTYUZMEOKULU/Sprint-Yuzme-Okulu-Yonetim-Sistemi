import type { CSSProperties } from "react";

const paths = {
  arrowRight: "M5 12h14m-6-6 6 6-6 6",
  arrowLeft: "M19 12H5m6 6-6-6 6-6",
  chevronRight: "m9 5 7 7-7 7",
  chevronDown: "m5 9 7 7 7-7",
  chevronUp: "m5 15 7-7 7 7",
  close: "m6 6 12 12M18 6 6 18",
  menu: "M4 6h16M4 12h16M4 18h16",
  home: "m3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7",
  key: "M15 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM9 10l-6 6v5h5v-3h3v-3l2-2",
  book: "M12 5v16M12 5C9 3 5 3 2 4v16c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Z",
  refresh: "M20 8a8 8 0 1 0 0 8M20 3v5h-5",
  logout: "M10 17l5-5-5-5M15 12H3M13 3h6v18h-6",
} as const;
export type UiIconName = keyof typeof paths;

/** Decorative icons inherit their control's colour and never replace its accessible label. */
export default function UiIcon({name,size=18,className,style}:{name:UiIconName;size?:number;className?:string;style?:CSSProperties}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className={className} style={{display:"inline-block",flexShrink:0,verticalAlign:"middle",...style}}><path d={paths[name]}/></svg>;
}
