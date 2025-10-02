import React, { useState, useEffect } from "react";


// const decodeProtobufAttributeName = (name) => {
//     try {
//       // Parse JSON
//       const data = JSON.parse(name);
//       const hexValue = data?.value;
//       if (!hexValue) return "";
  
//       // Convert hex string to bytes
//       const bytes = Buffer.from(hexValue, "hex");
  
//       // Try to decode as UTF-8 string
//       try {
//         // If you have protobuf parsing logic in JS, you can add it here
//         // For now, decode bytes to string and clean non-printable chars
//         const decodedStr = new TextDecoder("utf-8").decode(bytes);
//         // Remove non-printable chars
//         const cleaned = decodedStr.replace(/[^\x20-\x7E]/g, "");
//         return cleaned.trim();
//       } catch {
//         return "";
//       }
//     } catch (e) {
//       console.debug("[DEBUG decode] outer exception:", e);
//       return "";
//     }
//   };

const decodeProtobufAttributeName = (name) => {
    try {
      const data = JSON.parse(name);
      const hexValue = data?.value;
      if (!hexValue) return "";
  
      // Convert hex string to bytes (browser-compatible)
      const bytes = new Uint8Array(
        hexValue.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
      );
  
      // Decode bytes as UTF-8
      try {
        const decodedStr = new TextDecoder("utf-8").decode(bytes);
        const cleaned = decodedStr.replace(/[^\x20-\x7E]/g, "");
        return cleaned.trim();
      } catch {
        return "";
      }
    } catch (e) {
      console.debug("[DEBUG decode] outer exception:", e);
      return "";
    }
  };
  

export default function BenchMarkTest() {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const BASE_URL = window?.configs?.apiUrl ? window.configs.apiUrl : "/"

  useEffect(() => {
    const fetchAttributes = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log("\nStarting collection of datasets...");

        const url = `${BASE_URL}/v1/entities/search`;
        const payload = {
          kind: { major: "Dataset", minor: "tabular" },
        };
        const headers = { "Content-Type": "application/json" };

        const t0 = performance.now();
        const response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });
        const t1 = performance.now();
        console.log(
          `Time taken for request + response: ${((t1 - t0) / 1000).toFixed(4)}s`
        );

        if (!response.ok) throw new Error("Failed to fetch datasets");
        const allAttributes = await response.json();

        const body = allAttributes.body || [];
        if (body.length === 0) {
          setData({ message: "No attributes found" });
          setLoading(false);
          return;
        }

        const groupedByYear = {};

        for (const item of body) {
          let decodedName = "";
          const itemId = item.id || item.entityId || "";
          const rawName = item.name || "";
          const hashName = decodeProtobufAttributeName(rawName);
          const slicedId = itemId.split("_attr")[0];

          console.log(`\nStart gathering metadata for ${slicedId}...`);

          // Fetch metadata
          try {
            const metaUrl = `${BASE_URL}/v1/entities/${slicedId}/metadata`;
            const t0m = performance.now();
            const metaResp = await fetch(metaUrl, { headers });
            const t1m = performance.now();
            console.log(
              `Metadata fetch time: ${((t1m - t0m) / 1000).toFixed(4)}s`
            );

            if (metaResp.ok) {
              const metaJson = await metaResp.json();
              if (hashName in metaJson) {
                decodedName = decodeProtobufAttributeName(metaJson[hashName]);
              }
            }
          } catch (e) {
            console.error("Error fetching metadata", e);
            decodedName = "No description available";
          }

          // Extract year
          const created = item.created || item.createdAt || "";
          let yearKey = "unknown";
          if (created) {
            try {
              yearKey = new Date(created).getFullYear().toString();
            } catch {
              const match = created.match(/\b(20\d{2}|19\d{2})\b/);
              if (match) yearKey = match[0];
            }
          }

          // Parent/Parent-of-parent
          let parentOfParentCategoryId = "N/A";

          if (slicedId.includes("dep")) {
            console.log(
              `Found the main parent ministry/department (no API call needed) ${slicedId}`
            );
            parentOfParentCategoryId = slicedId;
          } else {
            console.log("API call is needed to find the parent...");

            let relatedParent = [];
            try {
              const relUrl = `${BASE_URL}/v1/entities/${slicedId}/relations`;
              const payload = {
                id: "",
                relatedEntityId: "",
                name: "AS_CATEGORY",
                activeAt: "",
                startTime: "",
                endTime: "",
                direction: "INCOMING",
              };

              const t0r = performance.now();
              const relResp = await fetch(relUrl, {
                method: "POST",
                headers,
                body: JSON.stringify(payload),
              });
              const t1r = performance.now();
              console.log(
                `Relations fetch time: ${((t1r - t0r) / 1000).toFixed(4)}s`
              );

              if (relResp.ok) {
                relatedParent = await relResp.json();
              }
            } catch (e) {
              console.error("Error fetching related parent", e);
            }

            if (Array.isArray(relatedParent) && relatedParent.length > 0) {
              const relatedEntityId = relatedParent[0]?.relatedEntityId;

              if (relatedEntityId) {
                let parentResponse = [];
                try {
                  const parentUrl = `${BASE_URL}/v1/entities/${relatedEntityId}/relations`;
                  const payload = {
                    id: "",
                    relatedEntityId: "",
                    name: "AS_CATEGORY",
                    activeAt: "",
                    startTime: "",
                    endTime: "",
                    direction: "INCOMING",
                  };

                  const t0p = performance.now();
                  const parentResp = await fetch(parentUrl, {
                    method: "POST",
                    headers,
                    body: JSON.stringify(payload),
                  });
                  const t1p = performance.now();
                  console.log(
                    `Parent fetch time: ${((t1p - t0p) / 1000).toFixed(4)}s`
                  );

                  if (parentResp.ok) {
                    parentResponse = await parentResp.json();
                  }
                } catch (e) {
                  console.error("Error fetching parent response", e);
                }

                if (Array.isArray(parentResponse) && parentResponse.length > 0) {
                  parentOfParentCategoryId =
                    parentResponse[0]?.relatedEntityId || "N/A";
                }
              }
            }
          }

          // Decode parent name
          let decodedParentOfParent = "N/A";
          if (parentOfParentCategoryId !== "N/A") {
            console.log("Fetching name of the base parent...");
            try {
              const parentSearchUrl = `${BASE_URL}/v1/entities/search`;
              const payload = { id: parentOfParentCategoryId };

              const t0s = performance.now();
              const parentEntityResp = await fetch(parentSearchUrl, {
                method: "POST",
                headers,
                body: JSON.stringify(payload),
              });
              const t1s = performance.now();
              console.log(
                `Parent name fetch time: ${((t1s - t0s) / 1000).toFixed(4)}s`
              );

              if (parentEntityResp.ok) {
                const parentEntity = await parentEntityResp.json();
                const parentBody = parentEntity.body || [];
                if (parentBody.length > 0) {
                  const parentRawName = parentBody[0]?.name || "";
                  decodedParentOfParent =
                    decodeProtobufAttributeName(parentRawName) || "N/A";
                }
              }
            } catch (e) {
              console.error("Error fetching parent entity", e);
            }
          }

          const simplified = {
            id: itemId,
            parent_of_parent_category_id: decodedParentOfParent,
            parent_entity_id: slicedId,
            attribute_hash_name: hashName,
            name: decodedName,
            created,
          };

          console.log("Final dataset:", simplified);

          if (!groupedByYear[yearKey]) groupedByYear[yearKey] = [];
          groupedByYear[yearKey].push(simplified);
        }

        setData({ attributes: groupedByYear });
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAttributes();
  }, [BASE_URL]);

  if (loading) return <p>Loading datasets...</p>;
  if (error) return <p style={{ color: "red" }}>Error: {error}</p>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
  <h2 className="text-2xl font-bold mb-6 text-gray-800">Dataset Explorer</h2>

  {data.message && (
    <p className="mb-4 text-gray-600 italic">{data.message}</p>
  )}

  {data.attributes &&
    Object.entries(data.attributes).map(([year, items]) => (
      <div key={year} className="mb-8">
        <h3 className="text-xl font-semibold mb-4 text-blue-700 border-b pb-1">
          {year}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white p-4 rounded-lg shadow hover:shadow-lg transition-shadow duration-200"
            >
              <h4 className="font-bold text-gray-900">{item.name}</h4>
              <p className="text-gray-600 text-sm">
                <span className="font-semibold">Parent:</span>{" "}
                {item.parent_of_parent_category_id || "N/A"}
              </p>
              <p className="text-gray-600 text-sm">
                <span className="font-semibold">Created:</span>{" "}
                {item.created || "N/A"}
              </p>
            </div>
          ))}
        </div>
      </div>
    ))}
</div>

  );
}
