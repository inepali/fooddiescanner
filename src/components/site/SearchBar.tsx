/** The big library search. A plain GET form to /search, so it works without JavaScript. */
export default function SearchBar({ defaultValue = "", autoFocus = false }: { defaultValue?: string; autoFocus?: boolean }) {
  return (
    <form
      role="search"
      action="/search"
      method="get"
      className="flex w-full max-w-3xl items-center gap-3 rounded-[22px] border-2 border-[#14201A] bg-white py-2.5 pl-5 pr-2.5 shadow-[0_18px_40px_rgba(20,32,26,0.12)] focus-within:shadow-[0_0_0_4px_rgba(242,183,5,0.55),0_18px_40px_rgba(20,32,26,0.14)] sm:pl-6"
    >
      <svg aria-hidden width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#14201A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <label htmlFor="library-q" className="sr-only">
        Search scanned foods
      </label>
      <input
        id="library-q"
        name="q"
        type="search"
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        autoComplete="off"
        maxLength={100}
        placeholder="Search a product, brand, ingredient or barcode…"
        className="h-14 min-w-0 flex-1 border-0 bg-transparent text-lg text-[#14201A] placeholder:text-[#6B7770] focus:outline-none sm:text-xl"
      />
      <button
        type="submit"
        className="flex min-h-14 shrink-0 items-center gap-2 rounded-2xl bg-[#1E6B45] px-5 text-[17px] font-bold text-white hover:bg-[#134A2F] sm:px-6"
      >
        <span className="hidden sm:inline">Search</span>
        <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
        <span className="sr-only sm:hidden">Search</span>
      </button>
    </form>
  );
}
