import { getSearchContent } from "@/lib/content";
import SearchClient from "./SearchClient";

export const dynamic = "force-dynamic";

export default async function SearchPage() {
  const titles = await getSearchContent();
  return <SearchClient titles={titles} />;
}
