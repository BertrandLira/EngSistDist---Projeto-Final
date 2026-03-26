import { AdvertiserUpload } from "@/components/AdvertiserUpload";

export default function AdvertiserPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Anunciante
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        O arquivo é enviado à API Nest, gravada no volume compartilhado e enfileirada
        para transcrição no worker FastAPI.
      </p>
      <div className="mt-8">
        <AdvertiserUpload />
      </div>
    </div>
  );
}
