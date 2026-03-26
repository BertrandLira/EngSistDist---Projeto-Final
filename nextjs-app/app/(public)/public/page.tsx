import { PublicVideoGallery } from "@/components/PublicVideoGallery";
import type { VideoListItem } from "@/components/PublicVideoGallery";
import { serverApiUrl } from "@/lib/api";

async function fetchVideos(): Promise<VideoListItem[]> {
  const base = serverApiUrl();
  const res = await fetch(`${base}/videos`, { cache: "no-store" });
  if (!res.ok) {
    return [];
  }
  const data = (await res.json()) as VideoListItem[];
  return Array.isArray(data) ? data : [];
}

export default async function PublicPage() {
  const videos = await fetchVideos();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Público
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Stream do MP4 vem da Nest (<code className="text-xs">/videos/:id/stream</code>
        ). Ao dar play, é feito POST para gerar perguntas (stub no worker).
      </p>
      <div className="mt-8">
        <PublicVideoGallery videos={videos} />
      </div>
    </div>
  );
}
