"""
WrkSpace Lead Crawler
=====================
Multi-source business & client lead scraper.

Sources:
  - JustDial      (local Indian businesses)
  - Sulekha       (local Indian services)
  - Yelp API      (global businesses via API or scrape)
  - Google Maps   (Places API / Google Search scrape)
  - Clutch.co     (agencies / tech companies)
  - Upwork RSS    (freelance project listings)
  - Freelancer    (open project listings)
  - IndiaMART     (B2B supplier/buyer leads)
  - LinkedIn      (public company search)
  - Behance       (design/creative job listings)

Output: leads_TIMESTAMP.json + leads_TIMESTAMP.csv + leads_latest.json

Usage:
  pip install -r requirements.txt
  python crawler.py --city "Hyderabad" --category "IT Services" --max 50

Optional API push:
  python crawler.py --city "Hyderabad" --category "Software" --api-url http://localhost:3000/api/leads
"""

import argparse
import csv
import json
import logging
import random
import re
import sys
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from urllib.parse import quote_plus, urljoin

import requests
from bs4 import BeautifulSoup

# ─── Logging ─────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("leads_crawler")

# ─── Config ──────────────────────────────────────────────────────────────────
OUTPUT_DIR = Path(__file__).parent / "output"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}
TIMEOUT = 15
DELAY = (1.0, 2.5)  # polite random sleep range


def _sleep():
    time.sleep(random.uniform(*DELAY))


def _get(url: str, **kwargs):
    try:
        resp = requests.get(url, headers=HEADERS, timeout=TIMEOUT, **kwargs)
        resp.raise_for_status()
        return resp
    except Exception as exc:
        log.warning(f"GET failed [{url[:80]}] — {exc}")
        return None


def _lead(source: str, **kw) -> dict:
    return {
        "id":           str(uuid.uuid4()),
        "businessName": kw.get("businessName", ""),
        "contactName":  kw.get("contactName", ""),
        "email":        kw.get("email", ""),
        "phone":        kw.get("phone", ""),
        "website":      kw.get("website", ""),
        "location":     kw.get("location", ""),
        "category":     kw.get("category", ""),
        "source":       source,
        "sourceUrl":    kw.get("sourceUrl", ""),
        "description":  kw.get("description", ""),
        "rating":       kw.get("rating", ""),
        "reviewCount":  kw.get("reviewCount", ""),
        "status":       "New",
        "priority":     kw.get("priority", "Medium"),
        "notes":        kw.get("notes", ""),
        "assignedTo":   "",
        "createdAt":    datetime.utcnow().isoformat(),
    }


# ═══════════════════════════════════════════════════════════════
# SOURCE 1 ▶ JustDial
# ═══════════════════════════════════════════════════════════════
def crawl_justdial(city: str, category: str, max_results: int = 40) -> list:
    leads = []
    city_slug = city.lower().replace(" ", "-")
    cat_slug = category.lower().replace(" ", "-")
    base = f"https://www.justdial.com/{city_slug}/{cat_slug}"
    log.info(f"[JustDial] {base}")

    for page in range(1, 5):
        url = f"{base}/page-{page}" if page > 1 else base
        resp = _get(url)
        if not resp:
            break
        soup = BeautifulSoup(resp.text, "html.parser")
        cards = (
            soup.select("li.cntanr")
            or soup.select("div.resultbox_info")
            or soup.select("div.jdcardshow")
        )
        for card in cards:
            if len(leads) >= max_results:
                return leads
            try:
                name_el = (
                    card.select_one("span.lng_false")
                    or card.select_one("h2.jcn")
                    or card.select_one("a.store-name")
                )
                name = name_el.get_text(strip=True) if name_el else ""
                if not name or len(name) < 2:
                    continue
                phone_el = card.select_one("p.contact-info") or card.select_one(".jd-tel")
                phone = phone_el.get_text(strip=True) if phone_el else ""
                addr_el = card.select_one("span.cont_fl_addr") or card.select_one(".jcn + p")
                location = addr_el.get_text(strip=True) if addr_el else city
                rating_el = card.select_one("span.green-box") or card.select_one(".rtngs")
                rating = rating_el.get_text(strip=True) if rating_el else ""
                review_el = card.select_one("span.rtngtxt") or card.select_one(".rtng_cnt")
                reviews = review_el.get_text(strip=True) if review_el else ""
                link_el = card.select_one("a[href]")
                src_url = urljoin("https://www.justdial.com", link_el["href"]) if link_el else url
                leads.append(_lead("JustDial", businessName=name, phone=phone, location=location,
                                   category=category, sourceUrl=src_url, rating=rating, reviewCount=reviews))
            except Exception as e:
                log.debug(f"[JustDial] {e}")
        _sleep()

    log.info(f"[JustDial] {len(leads)} leads")
    return leads


# ═══════════════════════════════════════════════════════════════
# SOURCE 2 ▶ Sulekha
# ═══════════════════════════════════════════════════════════════
def crawl_sulekha(city: str, category: str, max_results: int = 40) -> list:
    leads = []
    city_slug = city.lower().replace(" ", "-")
    cat_slug = category.lower().replace(" ", "-")
    base = f"https://www.sulekha.com/{cat_slug}/{city_slug}-service-providers"
    log.info(f"[Sulekha] {base}")

    for page in range(1, 4):
        url = f"{base}?page={page}"
        resp = _get(url)
        if not resp:
            break
        soup = BeautifulSoup(resp.text, "html.parser")
        cards = (
            soup.select("div.provider-card")
            or soup.select("div.prov-card")
            or soup.select("li.provider-listing")
        )
        for card in cards:
            if len(leads) >= max_results:
                return leads
            try:
                name_el = (
                    card.select_one("h2")
                    or card.select_one(".provider-name")
                    or card.select_one("a.prov-name")
                )
                name = name_el.get_text(strip=True) if name_el else ""
                if not name or len(name) < 2:
                    continue
                phone_el = card.select_one(".phone") or card.select_one("[data-phone]")
                phone = phone_el.get_text(strip=True) if phone_el else ""
                desc_el = card.select_one("p.desc") or card.select_one(".about-provider")
                desc = desc_el.get_text(strip=True) if desc_el else ""
                rating_el = card.select_one(".rating-val") or card.select_one("span.star-val")
                rating = rating_el.get_text(strip=True) if rating_el else ""
                link_el = card.select_one("a[href]")
                src_url = urljoin("https://www.sulekha.com", link_el["href"]) if link_el else url
                leads.append(_lead("Sulekha", businessName=name, phone=phone, location=city,
                                   category=category, sourceUrl=src_url, description=desc[:200], rating=rating))
            except Exception as e:
                log.debug(f"[Sulekha] {e}")
        _sleep()

    log.info(f"[Sulekha] {len(leads)} leads")
    return leads


# ═══════════════════════════════════════════════════════════════
# SOURCE 3 ▶ Yelp (API or scrape)
# ═══════════════════════════════════════════════════════════════
def crawl_yelp(city: str, category: str, api_key: str = "", max_results: int = 40) -> list:
    leads = []

    if api_key:
        log.info(f"[Yelp] Fusion API — {category} in {city}")
        url = "https://api.yelp.com/v3/businesses/search"
        hdrs = {**HEADERS, "Authorization": f"Bearer {api_key}"}
        for offset in range(0, max_results, 50):
            try:
                resp = requests.get(url, headers=hdrs, params={
                    "term": category, "location": city, "limit": 50, "offset": offset,
                }, timeout=TIMEOUT)
                for biz in resp.json().get("businesses", []):
                    leads.append(_lead("Yelp",
                        businessName=biz.get("name", ""),
                        phone=biz.get("phone", ""),
                        website=biz.get("url", ""),
                        location=", ".join(biz.get("location", {}).get("display_address", [])),
                        category=", ".join(c["title"] for c in biz.get("categories", [])),
                        sourceUrl=biz.get("url", ""),
                        rating=str(biz.get("rating", "")),
                        reviewCount=str(biz.get("review_count", "")),
                    ))
                _sleep()
            except Exception as e:
                log.warning(f"[Yelp API] {e}")
                break
    else:
        log.info(f"[Yelp] Scraping — {category} in {city}")
        for start in range(0, min(max_results, 30), 10):
            url = f"https://www.yelp.com/search?find_desc={quote_plus(category)}&find_loc={quote_plus(city)}&start={start}"
            resp = _get(url)
            if not resp:
                break
            soup = BeautifulSoup(resp.text, "html.parser")
            for card in soup.select("li.regular-search-result") or soup.select("div.arrange-unit__wrap"):
                if len(leads) >= max_results:
                    break
                try:
                    name_el = card.select_one("a[class*='businessName']") or card.select_one("span.css-1egxyab")
                    name = name_el.get_text(strip=True) if name_el else ""
                    if not name:
                        continue
                    link = name_el.get("href", "") if name_el else ""
                    rating_el = card.select_one("div[aria-label*='star']")
                    rating = (rating_el.get("aria-label", "").split(" star")[0]) if rating_el else ""
                    leads.append(_lead("Yelp", businessName=name, location=city, category=category,
                                       sourceUrl=urljoin("https://www.yelp.com", link), rating=rating))
                except Exception as e:
                    log.debug(f"[Yelp] {e}")
            _sleep()

    log.info(f"[Yelp] {len(leads)} leads")
    return leads


# ═══════════════════════════════════════════════════════════════
# SOURCE 4 ▶ Clutch.co
# ═══════════════════════════════════════════════════════════════
def crawl_clutch(category: str, city: str, max_results: int = 40) -> list:
    leads = []
    cat_slug = re.sub(r"[^a-z0-9]+", "-", category.lower()).strip("-")
    base = f"https://clutch.co/agencies/{cat_slug}"
    log.info(f"[Clutch] {base}")

    for page in range(0, 3):
        url = f"{base}?page={page}" if page else base
        resp = _get(url)
        if not resp:
            break
        soup = BeautifulSoup(resp.text, "html.parser")
        cards = soup.select("li.provider-row") or soup.select("article.provider")
        for card in cards:
            if len(leads) >= max_results:
                return leads
            try:
                name_el = card.select_one("h3.company_info") or card.select_one("h3")
                name = name_el.get_text(strip=True) if name_el else ""
                if not name:
                    continue
                rating_el = card.select_one("span.rating") or card.select_one(".sg-rating__number")
                rating = rating_el.get_text(strip=True) if rating_el else ""
                review_el = card.select_one("a.reviews") or card.select_one(".sg-rating__reviews")
                reviews = review_el.get_text(strip=True) if review_el else ""
                loc_el = card.select_one("span.locality") or card.select_one(".location")
                location = loc_el.get_text(strip=True) if loc_el else city
                desc_el = card.select_one("p.tagline") or card.select_one(".summary")
                desc = desc_el.get_text(strip=True) if desc_el else ""
                link_el = card.select_one("a[href*='/profile/']") or card.select_one("h3 a")
                src_url = urljoin("https://clutch.co", link_el["href"]) if link_el else url
                web_el = card.select_one("a[class*='website']")
                website = web_el["href"] if web_el and web_el.get("href") else ""
                leads.append(_lead("Clutch", businessName=name, website=website, location=location,
                                   category=category, sourceUrl=src_url, description=desc,
                                   rating=rating, reviewCount=reviews, priority="High"))
            except Exception as e:
                log.debug(f"[Clutch] {e}")
        _sleep()

    log.info(f"[Clutch] {len(leads)} leads")
    return leads


# ═══════════════════════════════════════════════════════════════
# SOURCE 5 ▶ Upwork (RSS feed)
# ═══════════════════════════════════════════════════════════════
def crawl_upwork(category: str, max_results: int = 40) -> list:
    leads = []
    q = quote_plus(category)
    url = f"https://www.upwork.com/ab/feed/jobs/rss?q={q}&sort=recency&paging=0%3B{max_results}"
    log.info(f"[Upwork] RSS: {url}")

    resp = _get(url)
    if not resp:
        return leads

    soup = BeautifulSoup(resp.text, "xml")
    for item in soup.find_all("item")[:max_results]:
        try:
            title_el = item.find("title")
            title = title_el.get_text(strip=True) if title_el else ""
            if not title:
                continue
            link_el = item.find("link")
            link = link_el.get_text(strip=True) if link_el else ""
            desc_el = item.find("description")
            desc_raw = BeautifulSoup(desc_el.get_text(), "html.parser").get_text(strip=True) if desc_el else ""
            budget_match = re.search(r"Budget:\s*\$?([\d,]+)", desc_raw)
            budget = budget_match.group(1) if budget_match else ""
            leads.append(_lead("Upwork", businessName=title, description=desc_raw[:300],
                               sourceUrl=link, category=category, location="Remote",
                               notes=f"Budget: ${budget}" if budget else "", priority="High"))
        except Exception as e:
            log.debug(f"[Upwork] {e}")

    log.info(f"[Upwork] {len(leads)} leads")
    return leads


# ═══════════════════════════════════════════════════════════════
# SOURCE 6 ▶ Freelancer.com
# ═══════════════════════════════════════════════════════════════
def crawl_freelancer(category: str, max_results: int = 40) -> list:
    leads = []
    cat_slug = re.sub(r"[^a-z0-9]+", "-", category.lower()).strip("-")
    url = f"https://www.freelancer.com/jobs/{cat_slug}/"
    log.info(f"[Freelancer] {url}")

    resp = _get(url)
    if not resp:
        return leads

    soup = BeautifulSoup(resp.text, "html.parser")
    cards = (
        soup.select("div.JobSearchCard-item")
        or soup.select("li.project-details")
        or soup.select("div[class*='JobCard']")
    )
    for card in cards[:max_results]:
        try:
            title_el = (
                card.select_one("h2 a")
                or card.select_one("a.JobSearchCard-primary-heading-link")
                or card.select_one(".project-title a")
            )
            title = title_el.get_text(strip=True) if title_el else ""
            if not title:
                continue
            link = urljoin("https://www.freelancer.com", title_el.get("href", "")) if title_el else url
            desc_el = card.select_one("p.JobSearchCard-secondary-description") or card.select_one(".project-description")
            desc = desc_el.get_text(strip=True) if desc_el else ""
            budget_el = card.select_one("div.JobSearchCard-secondary-price") or card.select_one(".project-budget")
            budget = budget_el.get_text(strip=True) if budget_el else ""
            leads.append(_lead("Freelancer", businessName=title, description=desc[:300],
                               sourceUrl=link, category=category, location="Remote",
                               notes=f"Budget: {budget}" if budget else "", priority="High"))
        except Exception as e:
            log.debug(f"[Freelancer] {e}")

    log.info(f"[Freelancer] {len(leads)} leads")
    return leads


# ═══════════════════════════════════════════════════════════════
# SOURCE 7 ▶ IndiaMART (B2B)
# ═══════════════════════════════════════════════════════════════
def crawl_indiamart(category: str, city: str, max_results: int = 30) -> list:
    leads = []
    url = f"https://www.indiamart.com/search.mp?ss={quote_plus(category)}&prdsrc=1&City={quote_plus(city)}"
    log.info(f"[IndiaMART] {url}")

    resp = _get(url)
    if not resp:
        return leads

    soup = BeautifulSoup(resp.text, "html.parser")
    cards = (
        soup.select("div.producttile")
        or soup.select("div.prd-list-item")
        or soup.select("div[class*='product-item']")
    )
    for card in cards[:max_results]:
        try:
            name_el = card.select_one("a.dn") or card.select_one(".companyname") or card.select_one("h3 a")
            name = name_el.get_text(strip=True) if name_el else ""
            if not name:
                continue
            phone_el = card.select_one("span.phone") or card.select_one("[data-phone]")
            phone = phone_el.get_text(strip=True) if phone_el else ""
            city_el = card.select_one("span.city") or card.select_one(".comp-city")
            location = city_el.get_text(strip=True) if city_el else city
            link_el = card.select_one("a[href]")
            src_url = urljoin("https://www.indiamart.com", link_el["href"]) if link_el else url
            desc_el = card.select_one("div.pdesc") or card.select_one(".product-name")
            desc = desc_el.get_text(strip=True) if desc_el else ""
            leads.append(_lead("IndiaMART", businessName=name, phone=phone, location=location,
                               category=category, sourceUrl=src_url, description=desc[:200]))
        except Exception as e:
            log.debug(f"[IndiaMART] {e}")

    log.info(f"[IndiaMART] {len(leads)} leads")
    return leads


# ═══════════════════════════════════════════════════════════════
# SOURCE 8 ▶ Google Maps (Places API or Google Search)
# ═══════════════════════════════════════════════════════════════
def crawl_google_maps(category: str, city: str, api_key: str = "", max_results: int = 40) -> list:
    leads = []

    if api_key:
        log.info(f"[Google Maps] Places API — {category} in {city}")
        url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
        next_token = None
        while len(leads) < max_results:
            params = {"query": f"{category} in {city}", "key": api_key}
            if next_token:
                params = {"pagetoken": next_token, "key": api_key}
                time.sleep(2)
            try:
                resp = requests.get(url, params=params, timeout=TIMEOUT)
                data = resp.json()
                for p in data.get("results", []):
                    if len(leads) >= max_results:
                        break
                    leads.append(_lead("Google Maps",
                        businessName=p.get("name", ""),
                        location=p.get("formatted_address", ""),
                        category=category,
                        sourceUrl=f"https://maps.google.com/?q={quote_plus(p.get('name',''))}",
                        rating=str(p.get("rating", "")),
                        reviewCount=str(p.get("user_ratings_total", "")),
                    ))
                next_token = data.get("next_page_token")
                if not next_token:
                    break
            except Exception as e:
                log.warning(f"[Google Maps API] {e}")
                break
    else:
        log.info(f"[Google Maps] Google Search — {category} near {city}")
        query = quote_plus(f"{category} near {city} contact phone address")
        url = f"https://www.google.com/search?q={query}&num=20"
        resp = _get(url)
        if resp:
            soup = BeautifulSoup(resp.text, "html.parser")
            for r in (soup.select("div.g") or soup.select("div.tF2Cxc"))[:max_results]:
                try:
                    name_el = r.select_one("h3")
                    name = name_el.get_text(strip=True) if name_el else ""
                    if not name:
                        continue
                    link_el = r.select_one("a[href]")
                    link = link_el["href"] if link_el else ""
                    snippet_el = r.select_one("span.aCOpRe") or r.select_one(".VwiC3b")
                    snippet = snippet_el.get_text(strip=True) if snippet_el else ""
                    leads.append(_lead("Google Maps", businessName=name, location=city,
                                       category=category, sourceUrl=link, description=snippet[:200]))
                except Exception as e:
                    log.debug(f"[Google] {e}")

    log.info(f"[Google Maps] {len(leads)} leads")
    return leads


# ═══════════════════════════════════════════════════════════════
# SOURCE 9 ▶ LinkedIn (public company search)
# ═══════════════════════════════════════════════════════════════
def crawl_linkedin(category: str, city: str, max_results: int = 30) -> list:
    leads = []
    query = quote_plus(f"{category} {city}")
    url = f"https://www.linkedin.com/search/results/companies/?keywords={query}&origin=SWITCH_SEARCH_VERTICAL"
    log.info(f"[LinkedIn] {url}")

    resp = _get(url)
    if not resp:
        return leads

    soup = BeautifulSoup(resp.text, "html.parser")
    cards = (
        soup.select("li.reusable-search__result-container")
        or soup.select("div.search-result__info")
    )
    for card in cards[:max_results]:
        try:
            name_el = card.select_one("span.entity-result__title-text") or card.select_one("a.app-aware-link span")
            name = name_el.get_text(strip=True) if name_el else ""
            if not name or name == "LinkedIn Member":
                continue
            link_el = card.select_one("a[href*='/company/']")
            link = link_el["href"].split("?")[0] if link_el else ""
            sub_el = card.select_one("div.entity-result__primary-subtitle")
            subtitle = sub_el.get_text(strip=True) if sub_el else ""
            leads.append(_lead("LinkedIn", businessName=name, location=city, category=category,
                               sourceUrl=urljoin("https://www.linkedin.com", link),
                               description=subtitle, priority="High"))
        except Exception as e:
            log.debug(f"[LinkedIn] {e}")

    log.info(f"[LinkedIn] {len(leads)} leads")
    return leads


# ═══════════════════════════════════════════════════════════════
# SOURCE 10 ▶ Behance (creative job/client listings)
# ═══════════════════════════════════════════════════════════════
def crawl_behance(category: str, max_results: int = 20) -> list:
    leads = []
    url = f"https://www.behance.net/joblist?field={quote_plus(category)}"
    log.info(f"[Behance] {url}")

    resp = _get(url)
    if not resp:
        return leads

    soup = BeautifulSoup(resp.text, "html.parser")
    cards = soup.select("article") or soup.select("li[class*='JobCard']")
    for card in cards[:max_results]:
        try:
            title_el = card.select_one("h3") or card.select_one("h2")
            title = title_el.get_text(strip=True) if title_el else ""
            if not title:
                continue
            company_el = card.select_one("span[class*='company']") or card.select_one("p")
            company = company_el.get_text(strip=True) if company_el else title
            link_el = card.select_one("a[href]")
            link = urljoin("https://www.behance.net", link_el["href"]) if link_el else url
            loc_el = card.select_one("span[class*='location']")
            loc = loc_el.get_text(strip=True) if loc_el else "Remote"
            leads.append(_lead("Behance", businessName=company or title, description=title,
                               sourceUrl=link, category=category, location=loc))
        except Exception as e:
            log.debug(f"[Behance] {e}")

    log.info(f"[Behance] {len(leads)} leads")
    return leads


# ═══════════════════════════════════════════════════════════════
# UTILITIES
# ═══════════════════════════════════════════════════════════════
def deduplicate(leads: list) -> list:
    seen, unique = set(), []
    for lead in leads:
        key = f"{lead['businessName'].lower().strip()}|{lead['source']}"
        if key not in seen and lead["businessName"].strip():
            seen.add(key)
            unique.append(lead)
    return unique


def save_results(leads: list, out_dir: Path) -> tuple:
    out_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")

    json_path = out_dir / f"leads_{ts}.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(leads, f, indent=2, ensure_ascii=False)

    latest_path = out_dir / "leads_latest.json"
    with open(latest_path, "w", encoding="utf-8") as f:
        json.dump(leads, f, indent=2, ensure_ascii=False)

    csv_path = out_dir / f"leads_{ts}.csv"
    if leads:
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=leads[0].keys())
            writer.writeheader()
            writer.writerows(leads)

    log.info(f"Saved → {json_path.name}  |  {csv_path.name}")
    return json_path, csv_path


def push_to_api(leads: list, api_url: str, api_key: str = ""):
    hdrs = {"Content-Type": "application/json"}
    if api_key:
        hdrs["Authorization"] = f"Bearer {api_key}"
    try:
        resp = requests.post(api_url, json={"leads": leads}, headers=hdrs, timeout=30)
        if resp.status_code in (200, 201):
            log.info(f"API push ✓ — {len(leads)} leads sent")
        else:
            log.warning(f"API push failed: {resp.status_code}")
    except Exception as e:
        log.warning(f"API push error: {e}")


# ═══════════════════════════════════════════════════════════════
# ORCHESTRATOR
# ═══════════════════════════════════════════════════════════════
def run(city, category, max_per_source, yelp_key, google_key, api_url, api_key, sources):
    crawlers = {
        "justdial":   lambda: crawl_justdial(city, category, max_per_source),
        "sulekha":    lambda: crawl_sulekha(city, category, max_per_source),
        "yelp":       lambda: crawl_yelp(city, category, yelp_key, max_per_source),
        "clutch":     lambda: crawl_clutch(category, city, max_per_source),
        "upwork":     lambda: crawl_upwork(category, max_per_source),
        "freelancer": lambda: crawl_freelancer(category, max_per_source),
        "indiamart":  lambda: crawl_indiamart(category, city, max_per_source),
        "google":     lambda: crawl_google_maps(category, city, google_key, max_per_source),
        "linkedin":   lambda: crawl_linkedin(category, city, max_per_source),
        "behance":    lambda: crawl_behance(category, max_per_source),
    }

    active = sources if sources else list(crawlers.keys())
    log.info(f"Crawling {len(active)} sources | city={city!r} | category={category!r}")

    all_leads = []
    with ThreadPoolExecutor(max_workers=3) as ex:
        futures = {ex.submit(crawlers[s]): s for s in active if s in crawlers}
        for future in as_completed(futures):
            src = futures[future]
            try:
                result = future.result()
                all_leads.extend(result)
            except Exception as exc:
                log.error(f"[{src}] {exc}")

    all_leads = deduplicate(all_leads)
    log.info(f"Total unique leads: {len(all_leads)}")

    save_results(all_leads, OUTPUT_DIR)
    if api_url:
        push_to_api(all_leads, api_url, api_key)

    return all_leads


# ─── CLI ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="WrkSpace Lead Crawler — multi-source business data scraper")
    ap.add_argument("--city",       default="Hyderabad",  help="Target city")
    ap.add_argument("--category",   default="IT Services", help="Business/service category")
    ap.add_argument("--max",        type=int, default=40,  help="Max leads per source")
    ap.add_argument("--sources",    nargs="*",             help="Sources to crawl (default: all 10)")
    ap.add_argument("--yelp-key",   default="",            help="Yelp Fusion API key")
    ap.add_argument("--google-key", default="",            help="Google Places API key")
    ap.add_argument("--api-url",    default="",            help="WrkSpace backend URL to push leads")
    ap.add_argument("--api-key",    default="",            help="WrkSpace API bearer token")
    args = ap.parse_args()

    leads = run(
        city=args.city,
        category=args.category,
        max_per_source=args.max,
        yelp_key=args.yelp_key,
        google_key=args.google_key,
        api_url=args.api_url,
        api_key=args.api_key,
        sources=args.sources,
    )

    print(f"\n{'='*60}")
    print(f"  ✅  Crawl complete — {len(leads)} unique leads collected")
    print(f"  📁  Output → leads_crawler/output/leads_latest.json")
    print(f"{'='*60}\n")
