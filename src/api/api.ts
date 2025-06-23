const BASE_URL = "http://localhost:4567/api";

export const fetchCompanyNews = async (company: string) => {
  const res = await fetch(`${BASE_URL}/company-news`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ company }),
  });
  return await res.json();
};

export const validateIndustry = async (company: string) => {
  const res = await fetch(`${BASE_URL}/validate-industry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ company }),
  });
  return await res.json();
};

export const fetchCompanyDetails = async (company: string) => {
  const res = await fetch(`${BASE_URL}/company-details`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ company }),
  });
  return await res.json();
};

export const saveReport = async (payload: Record<string, any>) => {
  const res = await fetch(`${BASE_URL}/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return await res.json();
};
