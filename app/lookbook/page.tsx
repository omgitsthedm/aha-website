import { DesignFiles } from "@/components/homepage/DesignFiles";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata = {
  title: "Design files",
  description: "Product artwork and previews connected to the After Hours Agenda design library.",
  alternates: { canonical: "/lookbook" },
};

export default function LookbookPage() {
  return (
    <div className="pb-20 pt-28 md:pt-32">
      <div className="px-4 md:px-6">
        <div className="mx-auto max-w-[1440px]">
          <PageHeader title="Design files" description="A working view of product artwork maintained in the project library on the Desktop." />
        </div>
      </div>
      <DesignFiles />
    </div>
  );
}
