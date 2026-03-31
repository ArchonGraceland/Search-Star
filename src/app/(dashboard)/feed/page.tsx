export default function Feed() {
  return (
    <div className="p-8">
      <div className="max-w-[960px]">
        <div className="mb-8">
          <h1 className="font-heading text-[32px] font-bold mb-1">Feed</h1>
          <p className="font-body text-sm text-[#767676]">Marketing messages, content subscriptions, and system notifications.</p>
        </div>

        <div className="bg-white border border-[#d4d4d4] rounded-[3px] shadow-sm p-8">
          <div className="text-center py-12">
            <p className="font-body text-sm text-[#b8b8b8] mb-4">Your feed is empty.</p>
            <p className="font-body text-sm text-[#767676]">
              Paid messages from platforms, content from your subscriptions, and system notifications will appear here.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
