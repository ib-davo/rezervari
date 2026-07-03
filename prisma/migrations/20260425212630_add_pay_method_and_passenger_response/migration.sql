-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "passengerResponse" TEXT,
ADD COLUMN     "passengerResponseAt" TIMESTAMP(3),
ADD COLUMN     "payMethod" TEXT;
