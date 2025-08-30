from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select, and_
from sqlalchemy.orm import Session
from ..db import get_session, Base, engine
from ..models import ProviderMachine, MarketplaceListing, RentalHistory
from ..schemas import MarketplaceListingRequest, MarketplaceSearchRequest, RentalRequest, RentalResponse
from ..security import require_auth
from ..config import settings
from typing import List, Optional
import json
from datetime import datetime, timedelta

# Ensure tables exist
if settings.enable_create_all:
    Base.metadata.create_all(bind=engine)

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

@router.post("/list")
def list_machine_for_rent(listing: MarketplaceListingRequest, _auth: dict = Depends(require_auth())):
    """List a machine on the marketplace for rent"""
    
    with get_session() as session:
        # Verify machine ownership
        machine = session.execute(
            select(ProviderMachine).where(
                and_(
                    ProviderMachine.machine_id == listing.machine_id,
                    ProviderMachine.provider_address == _auth.get("address")
                )
            )
        ).scalar_one_or_none()
        
        if not machine:
            raise HTTPException(status_code=404, detail="Machine not found or not owned by user")
        
        # Create or update marketplace listing
        existing_listing = session.execute(
            select(MarketplaceListing).where(MarketplaceListing.machine_id == listing.machine_id)
        ).scalar_one_or_none()
        
        if existing_listing:
            existing_listing.price_per_hour = listing.price_per_hour
            existing_listing.availability = listing.availability
            existing_listing.min_rental_hours = listing.min_rental_hours
            existing_listing.max_rental_hours = listing.max_rental_hours
            existing_listing.updated_at = datetime.utcnow()
        else:
            new_listing = MarketplaceListing(
                machine_id=listing.machine_id,
                provider_address=machine.provider_address,
                price_per_hour=listing.price_per_hour,
                availability=listing.availability,
                min_rental_hours=listing.min_rental_hours,
                max_rental_hours=listing.max_rental_hours,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            session.add(new_listing)
        
        return {"status": "listed", "machine_id": listing.machine_id}

@router.get("/search")
def search_marketplace(
    min_cpu: Optional[int] = None,
    min_gpu: Optional[int] = None,
    min_ram: Optional[int] = None,
    max_price: Optional[float] = None,
    availability: Optional[str] = None,
    _auth: dict = Depends(require_auth())
):
    """Search available machines in the marketplace"""
    
    with get_session() as session:
        # Base query for available listings
        query = select(MarketplaceListing, ProviderMachine).join(
            ProviderMachine, MarketplaceListing.machine_id == ProviderMachine.machine_id
        ).where(MarketplaceListing.availability == "available")
        
        # Apply filters
        if max_price:
            query = query.where(MarketplaceListing.price_per_hour <= max_price)
        
        if availability:
            query = query.where(MarketplaceListing.availability == availability)
        
        results = session.execute(query).all()
        
        # Filter by specs (stored as JSON)
        filtered_results = []
        for listing, machine in results:
            specs = json.loads(machine.specs) if machine.specs else {}
            
            if min_cpu and specs.get("cpu", 0) < min_cpu:
                continue
            if min_gpu and specs.get("gpu", 0) < min_gpu:
                continue
            if min_ram and specs.get("ram_gb", 0) < min_ram:
                continue
            
            filtered_results.append({
                "machine_id": machine.machine_id,
                "provider_address": machine.provider_address,
                "endpoint": machine.endpoint,
                "specs": specs,
                "price_per_hour": listing.price_per_hour,
                "availability": listing.availability,
                "min_rental_hours": listing.min_rental_hours,
                "max_rental_hours": listing.max_rental_hours,
                "created_at": listing.created_at,
                "updated_at": listing.updated_at
            })
        
        return {"machines": filtered_results}

@router.post("/rent")
def rent_machine(rental: RentalRequest, _auth: dict = Depends(require_auth())):
    """Rent a machine (this would typically interact with smart contracts)"""
    
    with get_session() as session:
        # Verify machine is available
        listing = session.execute(
            select(MarketplaceListing).where(
                and_(
                    MarketplaceListing.machine_id == rental.machine_id,
                    MarketplaceListing.availability == "available"
                )
            )
        ).scalar_one_or_none()
        
        if not listing:
            raise HTTPException(status_code=404, detail="Machine not available for rent")
        
        # Validate rental duration
        if rental.hours < listing.min_rental_hours or rental.hours > listing.max_rental_hours:
            raise HTTPException(
                status_code=400, 
                detail=f"Rental duration must be between {listing.min_rental_hours} and {listing.max_rental_hours} hours"
            )
        
        # Calculate total cost
        total_cost = listing.price_per_hour * rental.hours
        
        # TODO: Implement actual smart contract interaction here
        # For now, just record the rental
        
        rental_record = RentalHistory(
            machine_id=rental.machine_id,
            renter_address=_auth.get("address", "unknown"),
            provider_address=listing.provider_address,
            hours_rented=rental.hours,
            price_per_hour=listing.price_per_hour,
            total_cost=total_cost,
            rental_start=datetime.utcnow(),
            rental_end=datetime.utcnow() + timedelta(hours=rental.hours),
            status="active"
        )
        
        session.add(rental_record)
        
        # Update listing availability
        listing.availability = "rented"
        listing.updated_at = datetime.utcnow()
        
        return RentalResponse(
            rental_id=rental_record.id,
            machine_id=rental.machine_id,
            total_cost=total_cost,
            rental_start=rental_record.rental_start,
            rental_end=rental_record.rental_end,
            status="active"
        )

@router.get("/rentals")
def get_user_rentals(user_address: Optional[str] = None, _auth: dict = Depends(require_auth())):
    """Get rental history for a user"""
    
    with get_session() as session:
        address = user_address or _auth.get("address")
        
        rentals = session.execute(
            select(RentalHistory).where(
                RentalHistory.renter_address == address
            ).order_by(RentalHistory.rental_start.desc())
        ).scalars().all()
        
        return {
            "rentals": [
                {
                    "rental_id": rental.id,
                    "machine_id": rental.machine_id,
                    "provider_address": rental.provider_address,
                    "hours_rented": rental.hours_rented,
                    "price_per_hour": rental.price_per_hour,
                    "total_cost": rental.total_cost,
                    "rental_start": rental.rental_start,
                    "rental_end": rental.rental_end,
                    "status": rental.status
                }
                for rental in rentals
            ]
        }

@router.get("/earnings")
def get_provider_earnings(provider_address: Optional[str] = None, _auth: dict = Depends(require_auth())):
    """Get earnings for a provider"""
    
    with get_session() as session:
        address = provider_address or _auth.get("address")
        
        rentals = session.execute(
            select(RentalHistory).where(
                RentalHistory.provider_address == address
            ).order_by(RentalHistory.rental_start.desc())
        ).scalars().all()
        
        total_earnings = sum(rental.total_cost for rental in rentals)
        active_rentals = [r for r in rentals if r.status == "active"]
        
        return {
            "total_earnings": total_earnings,
            "active_rentals": len(active_rentals),
            "total_rentals": len(rentals),
            "recent_rentals": [
                {
                    "rental_id": rental.id,
                    "machine_id": rental.machine_id,
                    "renter_address": rental.renter_address,
                    "hours_rented": rental.hours_rented,
                    "total_cost": rental.total_cost,
                    "rental_start": rental.rental_start,
                    "rental_end": rental.rental_end,
                    "status": rental.status
                }
                for rental in rentals[:10]  # Last 10 rentals
            ]
        }