import { printfulRequest } from "./client";

interface MockupTask {
  task_key: string;
  status: string;
}

interface MockupResult {
  task_key: string;
  status: string;
  mockups?: {
    placement: string;
    variant_ids: number[];
    mockup_url: string;
    extra: { title: string; url: string }[];
  }[];
}

export async function generateMockup(
  productId: number,
  variantIds: number[],
  imageUrl: string
): Promise<string | null> {
  try {
    // Create mockup task
    const task = await printfulRequest<{ data: MockupTask }>(
      "/mockup-tasks",
      {
        method: "POST",
        body: {
          product_id: productId,
          variant_ids: variantIds,
          format: "jpg",
          files: [
            {
              placement: "front",
              image_url: imageUrl,
            },
          ],
        },
      }
    );

    if (!task.data?.task_key) return null;

    // Poll for result (max 30 seconds)
    for (let i = 0; i < 15; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const result = await printfulRequest<{ data: MockupResult }>(
        `/mockup-tasks/${task.data.task_key}`
      );

      if (result.data?.status === "completed" && result.data.mockups?.length) {
        return result.data.mockups[0].mockup_url;
      }

      if (result.data?.status === "failed") return null;
    }

    return null;
  } catch (error) {
    console.error("Failed to generate mockup:", error);
    return null;
  }
}
