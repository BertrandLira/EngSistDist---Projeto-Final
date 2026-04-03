import { PublicVideoGallery } from "@/components/PublicVideoGallery";
import type { VideoListItem } from "@/components/PublicVideoGallery";
import { serverApiUrl } from "@/lib/server-api-url";

async function fetchVideos(): Promise<VideoListItem[]> {
  const base = serverApiUrl();
  const res = await fetch(`${base}/videos`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as VideoListItem[];
  return Array.isArray(data) ? data : [];
}

export default async function PublicPage() {
  const videos = await fetchVideos();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Área Pública
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Dê play em um vídeo para gerar um desafio de retenção.
          </p>
        </div>
        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-sm font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          {videos.length} {videos.length === 1 ? "vídeo" : "vídeos"}
        </span>
      </div>

      <PublicVideoGallery videos={videos} />
    </div>
  );
}
