import unittest
from app import app


class SmartRouteFinderTests(unittest.TestCase):
    def setUp(self):
        app.config["TESTING"] = True
        self.client = app.test_client()

    def test_health(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["status"], "ok")

    def test_geocode_requires_query(self):
        response = self.client.get("/api/geocode?q=a")
        self.assertEqual(response.status_code, 400)

    def test_fuel_estimate(self):
        response = self.client.post("/api/fuel-estimate", json={
            "distance_km": 100, "mileage_kmpl": 20, "fuel_price": 100
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["fuel_cost"], 500)
        self.assertEqual(response.get_json()["fuel_litres"], 5)

    def test_fuel_estimate_rejects_zero_mileage(self):
        response = self.client.post("/api/fuel-estimate", json={
            "distance_km": 10, "mileage_kmpl": 0, "fuel_price": 100
        })
        self.assertEqual(response.status_code, 400)

    def test_route_requires_coordinates(self):
        response = self.client.post("/api/route", json={})
        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
