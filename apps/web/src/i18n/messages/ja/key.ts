import type { key as en } from "../en/key";

export const key: typeof en = {
  dialog: {
    title: "Deepgram キーを追加",
    close: "閉じる",
    intro:
      "Heard は Deepgram で文字起こしを行い、このサイトはあなた自身の Deepgram アカウントで動作します。登録は無料で、新規アカウントには無料クレジットが付きます。",
    step1: "次のサイトで登録またはログインします：",
    step2Before: "Heard 専用の API キーを作成します。",
    step2Role: "Member",
    step2After: " ロール（最小限の権限）を選び、有効期限を設定してください。いつでも無効にできます。",
    step3: "ここに貼り付けます。保存する前に Deepgram で確認します。",
    privacyStrong: "キーはこのブラウザ内に留まり、Deepgram にのみ送信されます。",
    privacyRest: "Heard のサーバーがキーを見ることはありません。字幕設定からいつでも削除できます。",
  },
  form: {
    label: "Deepgram API キー",
    placeholder: "キーを貼り付け",
    hide: "キーを隠す",
    show: "キーを表示",
    checking: "Deepgram で確認中…",
    submit: "確認して保存",
    cancel: "キャンセル",
    getKey: "キーを取得",
    errors: {
      empty: "先に Deepgram API キーを貼り付けてください。",
      malformed:
        "Deepgram API キーの形式ではないようです。Deepgram コンソールからキー全体をコピーしてください（キーは作成直後に一度だけ表示されます）。",
      rejected: "Deepgram がこのキーを受け付けませんでした。全体をコピーしたか、期限切れや削除されていないかを確認してください。",
      offline: "キーを確認するために Deepgram に接続できませんでした。接続を確認して、もう一度お試しください。",
    },
  },
  settings: {
    heading: "Deepgram キー",
    usingYours: "あなたのキーを使用中",
    usingServer: "サーバーのキーを使用中",
    none: "キーがまだありません。字幕を開始するには追加してください。",
    checking: "確認中…",
    forget: "キーを削除",
    removedServer: "キーを削除しました。Heard のサーバーのキーが再び使われます。",
    removed: "このブラウザからキーを削除しました。",
    tabOnly: "ブラウザがストレージをブロックしているため、キーはこのタブでのみ保持されます。",
    nextConnection: "次回の接続から使われます。今すぐ切り替えるには字幕を再起動してください。",
    replace: "キーを置き換える",
    useOwn: "自分の Deepgram キーを使う",
    add: "キーを追加",
    stays: "キーはこのブラウザ内に留まり、Deepgram にのみ送信されます。",
    prefer: "自分の Deepgram アカウントを使いたい場合：キーはこのブラウザ内に留まり、Deepgram にのみ送信されます。",
  },
  byok: {
    before: "無料の",
    link: "Deepgram API キー",
    after: "が必要です。キーはブラウザ内に留まり、Deepgram にのみ送信されます。Heard のサーバーには送信されません。",
  },
};
