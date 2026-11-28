import type { home as en } from "../en/home";

export const home: typeof en = {
  hero: {
    title: "どんな配信も、リアルタイムで字幕と吹き替え。",
    body: "配信を貼り付けるとリアルタイムで字幕が付きます。拡張機能なら吹き替えでも聞けます。",
    orTry: "試してみる",
  },
  examples: {
    msRachel: "幼児向け学習ライブ",
    skyNews: "24時間ライブニュース",
  },
  form: {
    label: "動画のリンク",
    placeholder: "YouTube か Twitch のリンクを貼り付け",
    placeholderCompact: "別の動画リンクを貼り付け",
    watch: "見る",
    watchWithCaptions: "字幕付きで見る",
    open: "開く",
    errors: {
      notALink: "https://www.youtube.com/watch?v=… のような動画の完全なリンクを貼り付けてください。",
      unknown: "Heard はまだこのリンクに対応していません。YouTube と Twitch の動画とライブ配信に対応しています。",
      extensionOnly: (platform) =>
        `${platform} は配信の埋め込みを許可していないため、Heard ではこのリンクをここで再生できません。${platform} で開き、Heard の Chrome 拡張機能で字幕をオンにしてください。`,
      clip: "Twitch のクリップにはまだ字幕を付けられません。チャンネルか動画のリンクを貼り付けるか、Twitch でクリップを開いて Heard の Chrome 拡張機能を使ってください。",
      channel:
        "@handle/live のようなチャンネルのリンクは直接開けません。YouTube で配信を開き、動画のリンク（youtube.com/watch?v=… または youtube.com/live/…）をコピーしてここに貼り付けてください。",
    },
  },
  how: {
    title: "使い方",
    intro: "Heard はタブの音声を直接聞くので、字幕のない動画でも使えます。",
    pasteTitle: "リンクを貼り付け",
    pasteBody: "YouTube の動画やライブ配信ならどれでも。",
    pasteNow: "今すぐ貼り付ける",
    startTitle: "「字幕を開始」をクリック",
    startBody: "Heard が Chrome にこのタブだけを求めます。",
    shareTitle: "タブの音声を共有",
    shareBody: "「このタブ」を選び、音声をオンのままに。",
  },
  privacy: {
    title: "プライバシー",
    intro: "Heard が聞くもの、送る先、保存するもの。",
    openSource: "Heard はオープンソースです。",
    policyLink: "Chrome 拡張機能のプライバシーポリシー",
    captionsBy: "字幕:",
    captionsAfter: "",
    onlyTabTitle: "選んだタブだけ",
    onlyTabBody: "それ以外は聞きません。",
    sentTitle: "字幕表示中だけ Deepgram に送信",
    sentBody: "字幕を止めれば送信も止まります。",
    savedTitle: "何も保存しません",
    savedBody: "タブを閉じるとトランスクリプトは消えます。",
    artTab: "タブ",
    artCaptionsOn: "字幕オン",
  },
  art: {
    startCaptions: "字幕を開始",
    thisTab: "このタブ",
    window: "ウィンドウ",
    screen: "画面全体",
    alsoShareAudio: "タブの音声も共有",
    cancel: "キャンセル",
    share: "共有",
  },
};
