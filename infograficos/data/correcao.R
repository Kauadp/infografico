rm(list = ls())

library(tidyverse)

dados <- read.csv('bling_export.csv', sep = ";")

table(dados$Fornecedor)
table(dados$Data.de.emissão)

dados$Data.de.emissão <- str_extract(dados$Data.de.emissão, "[0-9]+/[0-9]+/[0-9]+")
table(dados$Data.de.emissão)

high <- dados |> 
  filter(Fornecedor == "-")
