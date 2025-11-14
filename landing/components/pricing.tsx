export default function Pricing() {
  return (
    <section>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="py-12 md:py-20">
          {/* Section header */}
          <div className="mx-auto max-w-3xl pb-12 text-center md:pb-20">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">
              Choose the plan that works for you
            </h2>
            <p className="text-lg text-gray-700">
              Start for free and upgrade as you grow. All plans include core features.
            </p>
          </div>

          {/* Pricing cards */}
          <div className="mx-auto grid max-w-sm gap-6 lg:max-w-none lg:grid-cols-3">
            {/* Free tier */}
            <div className="relative flex flex-col rounded-2xl border border-transparent p-6 shadow-lg shadow-black/[0.03] before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:border before:border-transparent before:[background:linear-gradient(var(--color-gray-100),var(--color-gray-200))_border-box] before:[mask-composite:exclude_!important] before:[mask:linear-gradient(white_0_0)_padding-box,_linear-gradient(white_0_0)]">
              <div className="mb-5">
                <div className="mb-1 text-lg font-semibold">Free</div>
                <div className="mb-2 inline-flex items-baseline">
                  <span className="text-3xl font-bold">$0</span>
                </div>
                <div className="mb-5 text-sm text-gray-700">
                  Perfect for trying out Video Reader AI
                </div>
                <a
                  className="btn group mb-4 w-full bg-white text-gray-800 shadow-sm hover:bg-gray-50"
                  href="#"
                >
                  Get Started
                </a>
              </div>
              <div className="mb-3 font-medium">Includes:</div>
              <ul className="space-y-3 text-sm text-gray-700 grow">
                <li className="flex items-center">
                  <svg
                    className="mr-3 h-3 w-3 shrink-0 fill-emerald-500"
                    viewBox="0 0 12 12"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                  </svg>
                  <span>Translate first 3-5 minutes of video</span>
                </li>
                <li className="flex items-center">
                  <svg
                    className="mr-3 h-3 w-3 shrink-0 fill-emerald-500"
                    viewBox="0 0 12 12"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                  </svg>
                  <span>Basic translation quality</span>
                </li>
                <li className="flex items-center">
                  <svg
                    className="mr-3 h-3 w-3 shrink-0 fill-emerald-500"
                    viewBox="0 0 12 12"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                  </svg>
                  <span>No registration required</span>
                </li>
                <li className="flex items-center">
                  <svg
                    className="mr-3 h-3 w-3 shrink-0 fill-gray-400"
                    viewBox="0 0 12 12"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M11.854.146a.5.5 0 0 0-.707 0L6 5.293 .853.146a.5.5 0 1 0-.707.708L5.293 6 .146 11.146a.5.5 0 0 0 .708.708L6 6.707l5.146 5.147a.5.5 0 0 0 .708-.708L6.707 6l5.147-5.146a.5.5 0 0 0 0-.708Z" />
                  </svg>
                  <span className="text-gray-400">Full video translation</span>
                </li>
                <li className="flex items-center">
                  <svg
                    className="mr-3 h-3 w-3 shrink-0 fill-gray-400"
                    viewBox="0 0 12 12"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M11.854.146a.5.5 0 0 0-.707 0L6 5.293 .853.146a.5.5 0 1 0-.707.708L5.293 6 .146 11.146a.5.5 0 0 0 .708.708L6 6.707l5.146 5.147a.5.5 0 0 0 .708-.708L6.707 6l5.147-5.146a.5.5 0 0 0 0-.708Z" />
                  </svg>
                  <span className="text-gray-400">Download subtitles</span>
                </li>
              </ul>
            </div>

            {/* Pro tier */}
            <div className="relative flex flex-col rounded-2xl border border-transparent bg-gray-800 p-6 shadow-lg shadow-black/[0.03]">
              <div className="absolute right-6 top-0 -translate-y-1/2">
                <span className="inline-flex items-center rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white">
                  Most Popular
                </span>
              </div>
              <div className="mb-5">
                <div className="mb-1 text-lg font-semibold text-gray-200">Pro</div>
                <div className="mb-2 inline-flex items-baseline">
                  <span className="text-3xl font-bold text-gray-200">$9</span>
                  <span className="text-gray-500">/month</span>
                </div>
                <div className="mb-5 text-sm text-gray-500">
                  For regular users who watch foreign content
                </div>
                <a
                  className="btn group mb-4 w-full bg-linear-to-t from-blue-600 to-blue-500 bg-[length:100%_100%] bg-[bottom] text-white shadow-sm hover:bg-[length:100%_150%]"
                  href="#"
                >
                  Get Started
                </a>
              </div>
              <div className="mb-3 font-medium text-gray-200">Includes:</div>
              <ul className="space-y-3 text-sm text-gray-500 grow">
                <li className="flex items-center">
                  <svg
                    className="mr-3 h-3 w-3 shrink-0 fill-emerald-500"
                    viewBox="0 0 12 12"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                  </svg>
                  <span className="text-gray-300">Unlimited video length</span>
                </li>
                <li className="flex items-center">
                  <svg
                    className="mr-3 h-3 w-3 shrink-0 fill-emerald-500"
                    viewBox="0 0 12 12"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                  </svg>
                  <span className="text-gray-300">Download SRT/VTT/TXT files</span>
                </li>
                <li className="flex items-center">
                  <svg
                    className="mr-3 h-3 w-3 shrink-0 fill-emerald-500"
                    viewBox="0 0 12 12"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                  </svg>
                  <span className="text-gray-300">Karaoke-style highlighting</span>
                </li>
                <li className="flex items-center">
                  <svg
                    className="mr-3 h-3 w-3 shrink-0 fill-emerald-500"
                    viewBox="0 0 12 12"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                  </svg>
                  <span className="text-gray-300">Priority translation speed</span>
                </li>
                <li className="flex items-center">
                  <svg
                    className="mr-3 h-3 w-3 shrink-0 fill-emerald-500"
                    viewBox="0 0 12 12"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                  </svg>
                  <span className="text-gray-300">All languages supported</span>
                </li>
              </ul>
            </div>

            {/* Premium tier */}
            <div className="relative flex flex-col rounded-2xl border border-transparent p-6 shadow-lg shadow-black/[0.03] before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:border before:border-transparent before:[background:linear-gradient(var(--color-gray-100),var(--color-gray-200))_border-box] before:[mask-composite:exclude_!important] before:[mask:linear-gradient(white_0_0)_padding-box,_linear-gradient(white_0_0)]">
              <div className="mb-5">
                <div className="mb-1 text-lg font-semibold">Premium</div>
                <div className="mb-2 inline-flex items-baseline">
                  <span className="text-3xl font-bold">$19</span>
                  <span className="text-gray-700">/month</span>
                </div>
                <div className="mb-5 text-sm text-gray-700">
                  For professionals and content creators
                </div>
                <a
                  className="btn group mb-4 w-full bg-white text-gray-800 shadow-sm hover:bg-gray-50"
                  href="#"
                >
                  Get Started
                </a>
              </div>
              <div className="mb-3 font-medium">Includes:</div>
              <ul className="space-y-3 text-sm text-gray-700 grow">
                <li className="flex items-center">
                  <svg
                    className="mr-3 h-3 w-3 shrink-0 fill-emerald-500"
                    viewBox="0 0 12 12"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                  </svg>
                  <span>Everything in Pro, plus:</span>
                </li>
                <li className="flex items-center">
                  <svg
                    className="mr-3 h-3 w-3 shrink-0 fill-emerald-500"
                    viewBox="0 0 12 12"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                  </svg>
                  <span>Advanced GPT text processing</span>
                </li>
                <li className="flex items-center">
                  <svg
                    className="mr-3 h-3 w-3 shrink-0 fill-emerald-500"
                    viewBox="0 0 12 12"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                  </svg>
                  <span>Structured summaries and themes</span>
                </li>
                <li className="flex items-center">
                  <svg
                    className="mr-3 h-3 w-3 shrink-0 fill-emerald-500"
                    viewBox="0 0 12 12"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                  </svg>
                  <span>Auto Telegram post generation</span>
                </li>
                <li className="flex items-center">
                  <svg
                    className="mr-3 h-3 w-3 shrink-0 fill-emerald-500"
                    viewBox="0 0 12 12"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                  </svg>
                  <span>AI voice-over generation</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
