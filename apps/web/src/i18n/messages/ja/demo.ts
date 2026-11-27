import type { demo as en } from "../en/demo";

export const demo: typeof en = {
  group: "Heard を試す：ライブ字幕付きのデモプレーヤー、Chrome 拡張機能のポップアップ、文字起こし",
  listening: "聞き取り中",
  notListening: "停止中",
  startCaptions: "字幕を開始",
  stopCaptions: "字幕を停止",
  popup: {
    live: "ライブ",
    off: "オフ",
    statusLive: "文字起こし中",
    statusOff: "文字起こしオフ",
    aiCaptions: "AI 字幕",
    onText: "youtube.com のこのタブに字幕を表示中",
    offText: "オンにすると、このタブで再生中の音声に字幕を付けます。",
  },
  controls: {
    showCaptions: "字幕を表示",
    hideCaptions: "字幕を非表示",
    transcriptPanel: "文字起こしパネル",
    showTranscript: "文字起こしを表示",
    hideTranscript: "文字起こしを非表示",
    fullScreen: "全画面",
    exitFullScreen: "全画面を終了",
  },
  transcript: {
    title: "文字起こし",
    download: "ダウンロード",
    empty: "話された内容がここに表示されます。",
    noMatches: "一致なし",
    jumpTo: (time: string) => `${time} に移動`,
    search: "文字起こしを検索",
    clearSearch: "検索をクリア",
  },
  video: {
    play: "動画を再生",
    pause: "動画を一時停止",
    liveCaptions: "ライブ字幕",
    captionsOff: "字幕オフ",
    seek: "再生位置",
    seekValue: (now: string, total: string) => `${now} / ${total}`,
  },
};
