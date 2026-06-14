'use client';

export default function EcoRescuePage() {
  const handleAnswer = (answer: string) => {
    console.log("回答:", answer);
    alert("ご回答ありがとうございます！設定が完了しました。");
  };

  return (
    <main className="min-h-screen bg-orange-50 p-6 flex flex-col items-center justify-center font-sans text-gray-800">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center border-t-8 border-amber-500">
        <h1 className="text-2xl font-bold text-amber-900 mb-4">夕方のパンの救世主！</h1>
        <p className="text-gray-600 mb-8">
          夕方にパンが余りそうな時、LINEで「限定販売」の通知をお送りしてもよろしいですか？
        </p>

        <div className="space-y-4">
          <button 
            onClick={() => handleAnswer('weekday')}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 rounded-xl shadow-md transition-all active:scale-95"
          >
            平日夕方なら寄れる！
          </button>
          <button 
            onClick={() => handleAnswer('weekend')}
            className="w-full bg-orange-400 hover:bg-orange-500 text-white font-bold py-4 rounded-xl shadow-md transition-all active:scale-95"
          >
            土日祝なら寄れる！
          </button>
          <button 
            onClick={() => handleAnswer('none')}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-4 rounded-xl transition-all active:scale-95"
          >
            通知は不要
          </button>
        </div>
      </div>
    </main>
  );
}