export default function Home() {
  return (
    <main className="min-h-screen bg-orange-50 p-4 font-sans text-gray-800">
      {/* ヘッダー部分 */}
      <header className="text-center py-4">
        <h1 className="text-2xl font-bold text-amber-800">🍞 焼きたてベーカリー</h1>
        <p className="text-sm text-amber-600">デジタル会員証</p>
      </header>

      {/* 会員証カード部分 */}
      <div className="bg-white rounded-xl shadow-md p-6 my-4 border-t-4 border-amber-500">
        <div className="flex justify-between items-center text-sm text-gray-400">
          <span>会員ID: 1234-5678</span>
          <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">STANDARD</span>
        </div>
        <h2 className="text-xl font-bold mt-2">ゲスト 様</h2>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">お財布チャージ残高</p>
          <p className="text-4xl font-bold text-amber-600 tracking-tight">¥ 1,500</p>
        </div>

        {/* バーコード表示エリア（仮） */}
        <div className="mt-8 flex justify-center">
          <div className="w-full max-w-[250px] h-24 bg-gray-100 flex items-center justify-center rounded border border-gray-300 shadow-inner">
            <span className="text-gray-400 tracking-widest text-2xl font-mono">||| |||| ||||| |||</span>
          </div>
        </div>
        <p className="text-center text-xs text-gray-400 mt-2">レジでこのバーコードをご提示ください</p>
      </div>

      {/* アクションボタン */}
      <div className="grid grid-cols-2 gap-4 mt-6">
        <button className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-2 rounded-lg shadow-md transition-all active:scale-95">
          💳 チャージする
        </button>
        <button className="bg-orange-400 hover:bg-orange-500 text-white font-bold py-3 px-2 rounded-lg shadow-md transition-all active:scale-95">
          🥐 パンを取り置く
        </button>
      </div>
    </main>
  );
}