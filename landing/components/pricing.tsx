export default function Pricing() {
  return (
    <section>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="py-12 md:py-20">
          {/* Section header */}
          <div className="mx-auto max-w-3xl pb-12 text-center md:pb-20">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">
              Simple, transparent pricing
            </h2>
            <p className="text-lg text-gray-700">
              Start free. Upgrade anytime. Cancel anytime.
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
                  Try it out, no strings attached
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
                  <span>Translate up to 30% of video text</span>
                </li>
                <li className="flex items-center">
                  <svg
                    className="mr-3 h-3 w-3 shrink-0 fill-emerald-500"
                    viewBox="0 0 12 12"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                  </svg>
                  <span>Basic quality</span>
                </li>
                <li className="flex items-center">
                  <svg
                    className="mr-3 h-3 w-3 shrink-0 fill-emerald-500"
                    viewBox="0 0 12 12"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                  </svg>
                  <span>No export</span>
                </li>
                <li className="flex items-center">
                  <svg
                    className="mr-3 h-3 w-3 shrink-0 fill-emerald-500"
                    viewBox="0 0 12 12"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                  </svg>
                  <span>Great way to try the tool</span>
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
                  For serious learners and content consumers
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
                  <span className="text-gray-300">Translate 100% of subtitles</span>
                </li>
                <li className="flex items-center">
                  <svg
                    className="mr-3 h-3 w-3 shrink-0 fill-emerald-500"
                    viewBox="0 0 12 12"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                  </svg>
                  <span className="text-gray-300">Priority processing</span>
                </li>
                <li className="flex items-center">
                  <svg
                    className="mr-3 h-3 w-3 shrink-0 fill-emerald-500"
                    viewBox="0 0 12 12"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                  </svg>
                  <span className="text-gray-300">No export</span>
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
                  For creators and power users
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
                  <span>Translate 100%</span>
                </li>
                <li className="flex items-center">
                  <svg
                    className="mr-3 h-3 w-3 shrink-0 fill-emerald-500"
                    viewBox="0 0 12 12"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                  </svg>
                  <span>Export in SRT / VTT / TXT</span>
                </li>
                <li className="flex items-center">
                  <svg
                    className="mr-3 h-3 w-3 shrink-0 fill-emerald-500"
                    viewBox="0 0 12 12"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7A1 1 0 0010.28 2.28z" />
                  </svg>
                  <span>Priority resources</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
