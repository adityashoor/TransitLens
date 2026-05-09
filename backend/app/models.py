from __future__ import annotations

from sqlalchemy import BigInteger, Date, DateTime, Float, Integer, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from geoalchemy2 import Geography, Geometry


class Base(DeclarativeBase):
    pass


class Agency(Base):
    __tablename__ = "agency"

    agency_id: Mapped[str] = mapped_column(Text, primary_key=True)
    agency_name: Mapped[str] = mapped_column(Text)
    agency_url: Mapped[str | None] = mapped_column(Text)
    agency_timezone: Mapped[str | None] = mapped_column(Text)


class Route(Base):
    __tablename__ = "routes"

    route_id: Mapped[str] = mapped_column(Text, primary_key=True)
    agency_id: Mapped[str | None] = mapped_column(Text)
    route_short_name: Mapped[str | None] = mapped_column(Text)
    route_long_name: Mapped[str | None] = mapped_column(Text)
    route_type: Mapped[int | None] = mapped_column(Integer)
    route_color: Mapped[str | None] = mapped_column(Text)


class Stop(Base):
    __tablename__ = "stops"

    stop_id: Mapped[str] = mapped_column(Text, primary_key=True)
    stop_code: Mapped[str | None] = mapped_column(Text)
    stop_name: Mapped[str] = mapped_column(Text)
    stop_lat: Mapped[float | None] = mapped_column(Float)
    stop_lon: Mapped[float | None] = mapped_column(Float)
    geom: Mapped[object | None] = mapped_column(Geometry("POINT", srid=4326))


class Trip(Base):
    __tablename__ = "trips"

    trip_id: Mapped[str] = mapped_column(Text, primary_key=True)
    route_id: Mapped[str] = mapped_column(Text)
    service_id: Mapped[str] = mapped_column(Text)
    trip_headsign: Mapped[str | None] = mapped_column(Text)
    direction_id: Mapped[int | None] = mapped_column(Integer)
    shape_id: Mapped[str | None] = mapped_column(Text)


class StopTime(Base):
    __tablename__ = "stop_times"

    trip_id: Mapped[str] = mapped_column(Text, primary_key=True)
    stop_sequence: Mapped[int] = mapped_column(Integer, primary_key=True)
    stop_id: Mapped[str] = mapped_column(Text)
    arrival_time: Mapped[str | None] = mapped_column(Text)
    departure_time: Mapped[str | None] = mapped_column(Text)


class ShapePoint(Base):
    __tablename__ = "shapes"

    shape_id: Mapped[str] = mapped_column(Text, primary_key=True)
    shape_pt_sequence: Mapped[int] = mapped_column(Integer, primary_key=True)
    shape_pt_lat: Mapped[float] = mapped_column(Float)
    shape_pt_lon: Mapped[float] = mapped_column(Float)
    geom: Mapped[object | None] = mapped_column(Geometry("POINT", srid=4326))


class RidershipMatrix(Base):
    __tablename__ = "ridership_matrix"

    year: Mapped[int] = mapped_column(Integer, primary_key=True)
    media: Mapped[str] = mapped_column(Text, primary_key=True)
    rider_type: Mapped[str] = mapped_column(Text, primary_key=True)
    count: Mapped[int] = mapped_column(BigInteger)


class SurfaceRouteRidership(Base):
    __tablename__ = "surface_route_ridership"

    route_id: Mapped[str] = mapped_column(Text, primary_key=True)
    route_name: Mapped[str] = mapped_column(Text)
    rank: Mapped[int | None] = mapped_column(Integer)
    all_day_riders: Mapped[int | None] = mapped_column(BigInteger)
    sample_date: Mapped[object] = mapped_column(Date)


class BikeshareStation(Base):
    __tablename__ = "bikeshare_stations"

    station_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str | None] = mapped_column(Text)
    lat: Mapped[float | None] = mapped_column(Float)
    lon: Mapped[float | None] = mapped_column(Float)
    geom: Mapped[object | None] = mapped_column(Geography("POINT", srid=4326))


class BikeshareTrip(Base):
    __tablename__ = "bikeshare_trips"

    trip_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    trip_duration: Mapped[int | None] = mapped_column(Integer)
    start_station_id: Mapped[int | None] = mapped_column(Integer)
    start_time: Mapped[object | None] = mapped_column(DateTime)
    end_station_id: Mapped[int | None] = mapped_column(Integer)
    end_time: Mapped[object | None] = mapped_column(DateTime)
    bike_id: Mapped[int | None] = mapped_column(BigInteger)
    user_type: Mapped[str | None] = mapped_column(Text)
