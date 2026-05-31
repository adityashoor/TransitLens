# TransitLens — Project Abstract

**Competition:** Transit Data Conference 2026 Data Challenge
**Team:** TransitLens
**Thematic Areas:** Advanced data analytics and AI in public transit · Strategic and service planning · Equity analysis · Operations control and incident management · Visualization tools for transit data communication · Practical use of GTFS and GTFS-RT standards

---

## Abstract

Transit agencies operate at the intersection of complex real-time operations and long-term service equity, yet most decision-support systems address these challenges independently. TransitLens is an open-data transit intelligence platform developed for the Toronto Transit Commission (TTC) that integrates operational monitoring, equity analysis, safety intelligence, and demand forecasting within a single interactive web application.

The platform addresses three key transit planning challenges. First, it improves operational visibility by detecting bus bunching events in real time using TTC GTFS-RT vehicle position feeds. Vehicles operating on the same route are continuously analyzed using geospatial distance calculations, enabling TransitLens to identify clustering events and visualize service degradation as it occurs.

Second, TransitLens quantifies transit accessibility inequities across Toronto neighbourhoods through a mobility scoring framework that combines stop density, estimated wait times, and socioeconomic indicators. The system automatically identifies underserved communities and generates planning-oriented recommendations to support more equitable service allocation.

Third, TransitLens consolidates TTC delay incidents and Toronto Police Vision Zero collision data into a unified safety intelligence dashboard. Automated hotspot detection and route-level incident analysis help planners identify locations where safety interventions may have the greatest impact.

All analyses are performed exclusively using publicly available transit and government datasets, including GTFS, GTFS-RT, Toronto Open Data, Statistics Canada data products, and other open-data sources. No personally identifiable information (PII) is collected, stored, or inferred, ensuring full compliance with the Transit Data Challenge Privacy-First Principle.

TransitLens is deployed as a publicly accessible web application at **https://transit-lens.vercel.app/** and its complete source code is available through the public GitHub repository **https://github.com/adityashoor/TransitLens**, including documentation for local deployment and reproduction.

By integrating operational, equity, and safety intelligence into a unified decision-support environment, TransitLens demonstrates how open transit data can be transformed into actionable insights for planners, operators, policy-makers, and transit riders.
