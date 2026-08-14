CREATE TABLE `pendingAccessRequests` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  `requestedAt` timestamp NOT NULL DEFAULT (now()),
  `reviewedAt` timestamp,
  `reviewedBy` int,
  `note` varchar(500),
  CONSTRAINT `pendingAccessRequests_id` PRIMARY KEY(`id`),
  CONSTRAINT `pendingAccessRequests_userId_unique` UNIQUE(`userId`)
);
