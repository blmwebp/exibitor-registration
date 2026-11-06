import { useState } from 'react';

const photos = [
  { src: '/gallery/expo1.jpg', alt: 'Floor Plan1' },
  { src: '/gallery/expo2.jpg', alt: 'Floor Plan2' },
  { src: '/gallery/expo3.jpg', alt: 'Floor Plan3' },
  { src: '/gallery/expo4.jpg', alt: 'Floor Plan4' },
];

export default function ImageGallery() {
  const [current, setCurrent] = useState(0);
  const photo = photos[current];

  function move(direction: number) {
    setCurrent(index => (index + direction + photos.length) % photos.length);
  }

  return (
      <section
          className="w-full max-w-6xl bg-[#f5f7f2] px-4 py-10 my-[-10]"
          aria-label="Expo gallery"
      >
      <h2 className="mb-5 text-center text-2xl font-bold">Expo Gallery</h2>
    <div className="mx-auto flex w-full max-w-4xl items-center gap-2 sm:gap-4">
        <button
            type="button"
            aria-label="Previous photo"
            onClick={() => move(-1)}
            className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full bg-[#153b28] p-0 text-white shadow-md hover:bg-[#24553c] sm:size-11"
        >
                  <svg
                      aria-hidden="true"
                      className="block size-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                  >
                      <path d="M15 6l-6 6 6 6" />
                  </svg>
        </button>
      <div className="relative overflow-hidden rounded-2xl bg-gray-100 w-full max-w-3xl mx-auto">
        <img
          src={photo.src}
          alt={photo.alt}
          className="block aspect-[4/3] w-full object-cover sm:aspect-[36/25]"
        />
      </div>
              <button
                  type="button"
                  aria-label="Next photo"
                  onClick={() => move(1)}
                  className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full bg-[#153b28] text-2xl text-white shadow-md hover:bg-[#24553c] sm:size-11"
              >
                  <svg
                      aria-hidden="true"
                      className="block size-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                  >
                      <path d="M9 6l6 6-6 6" />
                  </svg>
              </button>
        </div>
      <p aria-live="polite" className="mt-3 text-center text-sm text-gray-600">
        Photo {current + 1} of {photos.length}
      </p>
    </section>
  );
}